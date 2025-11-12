import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import exifr from 'exifr';
import { authMiddleware, requireWhitelisted, AuthRequest } from '../middleware/auth';
import db from '../database';
import { Photo, PhotoMetadata, PhotoWithMetadata } from '@photos/shared';
import { detectFaces, findBestMatch } from '../utils/faceDetection';

const router = Router();

// Configure multer for file upload
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'));
        }
    },
});

// Helper to extract EXIF data
async function extractExifData(filePath: string): Promise<Partial<PhotoMetadata>> {
    try {
        const exifData = await exifr.parse(filePath);

        if (!exifData) return {};

        const metadata: Partial<PhotoMetadata> = {};

        metadata.cameraMake = exifData.Make || undefined;
        metadata.cameraModel = exifData.Model || undefined;
        metadata.lens = exifData.LensModel || undefined;
        metadata.focalLength = exifData.FocalLength ? `${exifData.FocalLength}mm` : undefined;
        metadata.aperture = exifData.FNumber ? `f/${exifData.FNumber}` : undefined;
        metadata.shutterSpeed = exifData.ExposureTime
            ? `1/${Math.round(1 / exifData.ExposureTime)}`
            : undefined;
        metadata.iso = exifData.ISO || undefined;
        metadata.flash =
            exifData.Flash !== undefined ? (exifData.Flash ? 'Fired' : 'Did not fire') : undefined;
        metadata.orientation = exifData.Orientation || undefined;

        if (exifData.latitude && exifData.longitude) {
            metadata.gpsLatitude = exifData.latitude;
            metadata.gpsLongitude = exifData.longitude;
        }

        return metadata;
    } catch (error) {
        console.error('Error extracting EXIF:', error);
        return {};
    }
}

// Helper to create thumbnail
async function createThumbnail(filePath: string, filename: string): Promise<void> {
    const thumbnailDir = path.join(uploadDir, 'thumbnails');
    const thumbnailPath = path.join(thumbnailDir, filename);

    await sharp(filePath)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
}

// Helper to create face thumbnail from bounding box
export async function createFaceThumbnail(
    photoIdOrPath: number | string,
    boundingBox: { x: number; y: number; width: number; height: number },
    faceId: number
): Promise<string> {
    // Get file path - either from photoId or use the path directly
    let filePath: string;
    if (typeof photoIdOrPath === 'number') {
        const photo = db.prepare('SELECT filename FROM photos WHERE id = ?').get(photoIdOrPath) as any;
        if (!photo) throw new Error('Photo not found');
        filePath = path.join(uploadDir, photo.filename);
    } else {
        filePath = photoIdOrPath;
    }

    const facesDir = path.join(uploadDir, 'faces');
    
    // Ensure faces directory exists
    if (!fs.existsSync(facesDir)) {
        fs.mkdirSync(facesDir, { recursive: true });
    }

    const faceFilename = `face-${faceId}.jpg`;
    const facePath = path.join(facesDir, faceFilename);

    // Add padding around the face (50% on each side for more context)
    const padding = 0.5;
    const paddedX = Math.max(0, Math.floor(boundingBox.x - boundingBox.width * padding));
    const paddedY = Math.max(0, Math.floor(boundingBox.y - boundingBox.height * padding));
    const paddedWidth = Math.floor(boundingBox.width * (1 + padding * 2));
    const paddedHeight = Math.floor(boundingBox.height * (1 + padding * 2));

    // Extract and resize the face region
    await sharp(filePath)
        .extract({
            left: paddedX,
            top: paddedY,
            width: paddedWidth,
            height: paddedHeight,
        })
        .resize(200, 200, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 85 })
        .toFile(facePath);

    return faceFilename;
}

// Helper to detect and match faces in a photo
async function detectFacesInPhoto(
    filePath: string,
    photoId: number,
    userId: number
): Promise<void> {
    try {
        // Detect faces in the photo
        const detectedFaces = await detectFaces(filePath);

        if (detectedFaces.length === 0) {
            return; // No faces detected
        }

        // Get all existing people for this user with their encodings
        const existingPeople = db
            .prepare('SELECT id, face_encoding FROM people WHERE user_id = ?')
            .all(userId) as Array<{ id: number; face_encoding: string }>;

        const knownEncodings = existingPeople.map((p) => ({
            personId: p.id,
            encoding: JSON.parse(p.face_encoding) as number[],
        }));

        // Process each detected face
        for (const face of detectedFaces) {
            // Try to match with existing people
            const matchedPersonId = findBestMatch(face.encoding, knownEncodings);

            let personId: number;
            let faceDetectionId: number;

            if (matchedPersonId) {
                // Face matches an existing person
                personId = matchedPersonId;
            } else {
                // Create a new person for this face (will update with face thumbnail later)
                const result = db
                    .prepare(
                        `
          INSERT INTO people (user_id, face_encoding, thumbnail_photo_id)
          VALUES (?, ?, ?)
        `
                    )
                    .run(userId, JSON.stringify(face.encoding), photoId);

                personId = result.lastInsertRowid as number;

                // Add to known encodings for subsequent faces in this photo
                knownEncodings.push({
                    personId,
                    encoding: face.encoding,
                });
            }

            // Insert face detection record
            const detectionResult = db.prepare(
                `
        INSERT INTO face_detections (photo_id, person_id, face_encoding, bounding_box, confidence)
        VALUES (?, ?, ?, ?, ?)
      `
            ).run(
                photoId,
                personId,
                JSON.stringify(face.encoding),
                JSON.stringify(face.boundingBox),
                face.confidence
            );

            faceDetectionId = detectionResult.lastInsertRowid as number;

            // Create face thumbnail
            try {
                const faceFilename = await createFaceThumbnail(
                    filePath,
                    face.boundingBox,
                    faceDetectionId
                );

                // Update person with face thumbnail if they don't have one yet
                const person = db
                    .prepare('SELECT face_thumbnail FROM people WHERE id = ?')
                    .get(personId) as { face_thumbnail: string | null } | undefined;

                if (!person?.face_thumbnail) {
                    db.prepare('UPDATE people SET face_thumbnail = ? WHERE id = ?').run(
                        faceFilename,
                        personId
                    );
                }
            } catch (error) {
                console.error('Error creating face thumbnail:', error);
                // Continue even if thumbnail creation fails
            }

            // Update person's updated_at timestamp
            db.prepare('UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
                personId
            );
        }
    } catch (error) {
        console.error('Error in detectFacesInPhoto:', error);
        throw error;
    }
}

// Upload photos (requires whitelist)
router.post(
    '/',
    authMiddleware,
    requireWhitelisted,
    upload.array('photos', 10),
    async (req: AuthRequest, res) => {
        try {
            const files = req.files as Express.Multer.File[];

            if (!files || files.length === 0) {
                return res.status(400).json({ error: 'Bad Request', message: 'No files uploaded' });
            }

            const photos: Photo[] = [];

            for (const file of files) {
                // Get image dimensions
                const metadata = await sharp(file.path).metadata();

                // Extract EXIF data
                const exifData = await extractExifData(file.path);

                // Create thumbnail
                await createThumbnail(file.path, file.filename);

                // Insert photo record
                const result = db
                    .prepare(
                        `
        INSERT INTO photos (user_id, filename, original_name, mime_type, size, width, height, taken_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
                    )
                    .run(
                        req.userId,
                        file.filename,
                        file.originalname,
                        file.mimetype,
                        file.size,
                        metadata.width,
                        metadata.height,
                        null // taken_at from EXIF could be added here
                    );

                const photoId = result.lastInsertRowid as number;

                // Insert metadata if available
                if (Object.keys(exifData).length > 0) {
                    db.prepare(
                        `
          INSERT INTO photo_metadata (
            photo_id, camera_make, camera_model, lens, focal_length, aperture, shutter_speed,
            iso, flash, gps_latitude, gps_longitude, location_name, orientation
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
                    ).run(
                        photoId,
                        exifData.cameraMake || null,
                        exifData.cameraModel || null,
                        exifData.lens || null,
                        exifData.focalLength || null,
                        exifData.aperture || null,
                        exifData.shutterSpeed || null,
                        exifData.iso || null,
                        exifData.flash || null,
                        exifData.gpsLatitude || null,
                        exifData.gpsLongitude || null,
                        exifData.locationName || null,
                        exifData.orientation || null
                    );
                }

                // Get the inserted photo
                const photo = db
                    .prepare(
                        `
        SELECT 
          id,
          user_id as userId,
          filename,
          original_name as originalName,
          mime_type as mimeType,
          size,
          width,
          height,
          taken_at as takenAt,
          uploaded_at as uploadedAt
        FROM photos WHERE id = ?
      `
                    )
                    .get(photoId) as any;

                photo.url = `/uploads/${photo.filename}`;
                photo.thumbnailUrl = `/uploads/thumbnails/${photo.filename}`;

                photos.push(photo);

                // Detect faces in the photo (async, don't block response)
                detectFacesInPhoto(file.path, photoId, req.userId!).catch((err) =>
                    console.error('Face detection error:', err)
                );
            }

            res.status(201).json({ photos });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to upload photos',
            });
        }
    }
);

// Get all photos for user
router.get('/', authMiddleware, (req: AuthRequest, res) => {
    try {
        const photos = db
            .prepare(
                `
      SELECT 
        id,
        user_id as userId,
        filename,
        original_name as originalName,
        mime_type as mimeType,
        size,
        width,
        height,
        taken_at as takenAt,
        uploaded_at as uploadedAt
      FROM photos
      WHERE user_id = ?
      ORDER BY uploaded_at DESC
    `
            )
            .all(req.userId) as any[];

        const photosWithUrls = photos.map((photo) => ({
            ...photo,
            url: `/uploads/${photo.filename}`,
            thumbnailUrl: `/uploads/thumbnails/${photo.filename}`,
        }));

        res.json(photosWithUrls);
    } catch (error) {
        console.error('Get photos error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get photos' });
    }
});

// Get photo by ID
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
    try {
        const photo = db
            .prepare(
                `
      SELECT 
        id,
        user_id as userId,
        filename,
        original_name as originalName,
        mime_type as mimeType,
        size,
        width,
        height,
        taken_at as takenAt,
        uploaded_at as uploadedAt
      FROM photos
      WHERE id = ? AND user_id = ?
    `
            )
            .get(req.params.id, req.userId) as any;

        if (!photo) {
            return res.status(404).json({ error: 'Not Found', message: 'Photo not found' });
        }

        photo.url = `/uploads/${photo.filename}`;
        photo.thumbnailUrl = `/uploads/thumbnails/${photo.filename}`;

        res.json(photo);
    } catch (error) {
        console.error('Get photo error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get photo' });
    }
});

// Get photo metadata
router.get('/:id/metadata', authMiddleware, (req: AuthRequest, res) => {
    try {
        // First verify the photo belongs to the user
        const photo = db
            .prepare('SELECT id FROM photos WHERE id = ? AND user_id = ?')
            .get(req.params.id, req.userId);

        if (!photo) {
            return res.status(404).json({ error: 'Not Found', message: 'Photo not found' });
        }

        const photoData = db
            .prepare(
                `
      SELECT 
        id,
        user_id as userId,
        filename,
        original_name as originalName,
        mime_type as mimeType,
        size,
        width,
        height,
        taken_at as takenAt,
        uploaded_at as uploadedAt,
        '/uploads/' || filename as url,
        '/uploads/thumbnails/' || filename as thumbnailUrl
      FROM photos
      WHERE id = ?
    `
            )
            .get(req.params.id);

        const metadata = db
            .prepare(
                `
      SELECT 
        id,
        photo_id as photoId,
        camera_make as cameraMake,
        camera_model as cameraModel,
        lens,
        focal_length as focalLength,
        aperture,
        shutter_speed as shutterSpeed,
        iso,
        flash,
        gps_latitude as gpsLatitude,
        gps_longitude as gpsLongitude,
        location_name as locationName,
        orientation
      FROM photo_metadata
      WHERE photo_id = ?
    `
            )
            .get(req.params.id);

        res.json({
            ...(photoData as any),
            metadata: metadata || null,
        });
    } catch (error) {
        console.error('Get metadata error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get metadata' });
    }
});

// Get face detections for a photo
router.get('/:id/faces', authMiddleware, (req: AuthRequest, res) => {
    try {
        // First verify the photo belongs to the user
        const photo = db
            .prepare('SELECT id FROM photos WHERE id = ? AND user_id = ?')
            .get(req.params.id, req.userId);

        if (!photo) {
            return res.status(404).json({ error: 'Not Found', message: 'Photo not found' });
        }

        const faceDetections = db
            .prepare(
                `
                SELECT 
                    fd.id,
                    fd.photo_id as photoId,
                    fd.person_id as personId,
                    fd.bounding_box as boundingBox,
                    fd.confidence,
                    fd.detected_at as detectedAt,
                    p.id as personId,
                    p.name as personName,
                    p.face_thumbnail as personThumbnail
                FROM face_detections fd
                LEFT JOIN people p ON fd.person_id = p.id
                WHERE fd.photo_id = ?
                ORDER BY fd.id
                `
            )
            .all(req.params.id);

        // Parse bounding box JSON strings
        const faces = faceDetections.map((face: any) => ({
            ...face,
            boundingBox: JSON.parse(face.boundingBox),
            personThumbnailUrl: face.personThumbnail ? `/uploads/faces/${face.personThumbnail}` : null,
        }));

        res.json(faces);
    } catch (error) {
        console.error('Get face detections error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get face detections' });
    }
});

// Delete photo
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
    try {
        const photo = db
            .prepare('SELECT filename FROM photos WHERE id = ? AND user_id = ?')
            .get(req.params.id, req.userId) as any;

        if (!photo) {
            return res.status(404).json({ error: 'Not Found', message: 'Photo not found' });
        }

        // Delete files
        const filePath = path.join(uploadDir, photo.filename);
        const thumbnailPath = path.join(uploadDir, 'thumbnails', photo.filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
        }

        // Delete from database (cascades to metadata and album_photos)
        db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);

        res.json({ success: true, message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Delete photo error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete photo' });
    }
});

export default router;
