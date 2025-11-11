import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import exifr from 'exifr';
import { authMiddleware, requireWhitelisted, AuthRequest } from '../middleware/auth';
import db from '../database';
import { Photo, PhotoMetadata, PhotoWithMetadata } from '@photos/shared';

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
