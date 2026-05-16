import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Person, PersonWithPhotos, UpdatePersonRequest } from '@photos/shared';

const router = Router();

// Get all people for the current user
router.get('/', authMiddleware, (req: AuthRequest, res) => {
    try {
        const people = db
            .prepare(
                `
      SELECT 
        p.id,
        p.user_id as userId,
        p.name,
        p.thumbnail_photo_id as thumbnailPhotoId,
        p.face_thumbnail as faceThumbnail,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        COUNT(DISTINCT fd.photo_id) as photoCount
      FROM people p
      LEFT JOIN face_detections fd ON p.id = fd.person_id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY photoCount DESC, p.created_at DESC
    `
            )
            .all(req.userId) as any[];

        // Add thumbnail URLs
        const peopleWithUrls = people.map((person) => ({
            ...person,
            thumbnailUrl: person.faceThumbnail
                ? `/uploads/faces/${person.faceThumbnail}`
                : undefined,
        }));

        res.json(peopleWithUrls);
    } catch (error) {
        console.error('Get people error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get people',
        });
    }
});

// Get person by ID with their photos
router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
    try {
        const personId = parseInt(req.params.id);

        // Get person details
        const person = db
            .prepare(
                `
      SELECT 
        p.id,
        p.user_id as userId,
        p.name,
        p.thumbnail_photo_id as thumbnailPhotoId,
        p.face_thumbnail as faceThumbnail,
        p.created_at as createdAt,
        p.updated_at as updatedAt
      FROM people p
      WHERE p.id = ? AND p.user_id = ?
    `
            )
            .get(personId, req.userId) as any | undefined;

        if (!person) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Person not found',
            });
        }

        // Get all photos containing this person
        const photos = db
            .prepare(
                `
      SELECT DISTINCT
        ph.id,
        ph.user_id as userId,
        ph.filename,
        ph.original_name as originalName,
        ph.mime_type as mimeType,
        ph.size,
        ph.width,
        ph.height,
        ph.taken_at as takenAt,
        ph.uploaded_at as uploadedAt
      FROM photos ph
      INNER JOIN face_detections fd ON ph.id = fd.photo_id
      WHERE fd.person_id = ? AND ph.user_id = ?
      ORDER BY ph.uploaded_at DESC
    `
            )
            .all(personId, req.userId) as any[];

        // Add URLs to photos
        const photosWithUrls = photos.map((photo) => ({
            ...photo,
            url: `/uploads/${photo.filename}`,
            thumbnailUrl: `/uploads/thumbnails/${photo.filename}`,
        }));

        // Count photos
        const photoCount = photosWithUrls.length;

        // Add thumbnail URL to person
        const personWithPhotos: PersonWithPhotos = {
            ...person,
            photoCount,
            thumbnailUrl: person.faceThumbnail
                ? `/uploads/faces/${person.faceThumbnail}`
                : undefined,
            photos: photosWithUrls,
        };

        res.json(personWithPhotos);
    } catch (error) {
        console.error('Get person error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get person',
        });
    }
});

// Update person (set name)
router.patch('/:id', authMiddleware, (req: AuthRequest, res) => {
    try {
        const personId = parseInt(req.params.id);
        const { name }: UpdatePersonRequest = req.body;

        // Verify person belongs to user
        const person = db
            .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
            .get(personId, req.userId);

        if (!person) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Person not found',
            });
        }

        // Update name
        db.prepare('UPDATE people SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            name || null,
            personId
        );

        // Get updated person
        const updatedPerson = db
            .prepare(
                `
      SELECT 
        p.id,
        p.user_id as userId,
        p.name,
        p.thumbnail_photo_id as thumbnailPhotoId,
        p.face_thumbnail as faceThumbnail,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        COUNT(DISTINCT fd.photo_id) as photoCount
      FROM people p
      LEFT JOIN face_detections fd ON p.id = fd.person_id
      WHERE p.id = ?
      GROUP BY p.id
    `
            )
            .get(personId) as any;

        // Add thumbnail URL
        const personWithUrl = {
            ...updatedPerson,
            thumbnailUrl: updatedPerson.faceThumbnail
                ? `/uploads/faces/${updatedPerson.faceThumbnail}`
                : undefined,
        };

        res.json(personWithUrl);
    } catch (error) {
        console.error('Update person error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update person',
        });
    }
});

// Set thumbnail from a photo
router.post('/:id/thumbnail/:photoId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const personId = parseInt(req.params.id);
        const photoId = parseInt(req.params.photoId);

        // Verify person belongs to user
        const person = db
            .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
            .get(personId, req.userId);

        if (!person) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Person not found',
            });
        }

        // Verify photo exists and person is in it
        const faceDetection = db
            .prepare(
                `SELECT id, bounding_box FROM face_detections 
                 WHERE person_id = ? AND photo_id = ?`
            )
            .get(personId, photoId) as any;

        if (!faceDetection) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'This person is not in the specified photo',
            });
        }

        // Import the createFaceThumbnail function from photos route
        const { createFaceThumbnail } = require('./photos');
        const boundingBox = JSON.parse(faceDetection.bounding_box);

        // Create new face thumbnail
        const faceFilename = await createFaceThumbnail(photoId, boundingBox, faceDetection.id);

        // Update person with new thumbnail
        db.prepare(
            'UPDATE people SET face_thumbnail = ?, thumbnail_photo_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(faceFilename, photoId, personId);

        res.json({ success: true, thumbnailUrl: `/uploads/faces/${faceFilename}` });
    } catch (error) {
        console.error('Set thumbnail error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to set thumbnail',
        });
    }
});

// Delete person
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
    try {
        const personId = parseInt(req.params.id);

        // Verify person belongs to user
        const person = db
            .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
            .get(personId, req.userId);

        if (!person) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Person not found',
            });
        }

        // Delete person (cascade will delete face_detections)
        db.prepare('DELETE FROM people WHERE id = ?').run(personId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete person error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete person',
        });
    }
});

// Merge two people (merge sourcePerson into targetPerson)
router.post('/:targetId/merge/:sourceId', authMiddleware, (req: AuthRequest, res) => {
    try {
        const targetId = parseInt(req.params.targetId);
        const sourceId = parseInt(req.params.sourceId);

        if (targetId === sourceId) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot merge a person with themselves',
            });
        }

        // Verify both people belong to user
        const target = db
            .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
            .get(targetId, req.userId);
        const source = db
            .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
            .get(sourceId, req.userId);

        if (!target || !source) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'One or both people not found',
            });
        }

        // Move all face detections from source to target
        db.prepare('UPDATE face_detections SET person_id = ? WHERE person_id = ?').run(
            targetId,
            sourceId
        );

        // Update target person's updated_at
        db.prepare('UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetId);

        // Delete source person
        db.prepare('DELETE FROM people WHERE id = ?').run(sourceId);

        res.json({ success: true, message: 'People merged successfully' });
    } catch (error) {
        console.error('Merge people error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to merge people',
        });
    }
});

// Reassign a photo from one person to another (or create new person)
router.post('/:personId/photos/:photoId/reassign', authMiddleware, (req: AuthRequest, res) => {
    try {
        const personId = parseInt(req.params.personId);
        const photoId = parseInt(req.params.photoId);
        const { targetPersonId, createNew } = req.body;

        // Verify person and photo belong to user
        const person = db
            .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
            .get(personId, req.userId);
        const photo = db
            .prepare('SELECT id FROM photos WHERE id = ? AND user_id = ?')
            .get(photoId, req.userId);

        if (!person || !photo) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Person or photo not found',
            });
        }

        // Get face detections for this person in this photo
        const faceDetections = db
            .prepare(
                'SELECT id, face_encoding, bounding_box, confidence FROM face_detections WHERE person_id = ? AND photo_id = ?'
            )
            .all(personId, photoId) as Array<{
            id: number;
            face_encoding: string;
            bounding_box: string;
            confidence: number;
        }>;

        if (faceDetections.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'No face detections found for this person in this photo',
            });
        }

        let newPersonId: number;

        if (createNew) {
            // Create a new person with the first face detection
            const firstDetection = faceDetections[0];
            const result = db
                .prepare(
                    'INSERT INTO people (user_id, face_encoding, thumbnail_photo_id) VALUES (?, ?, ?)'
                )
                .run(req.userId, firstDetection.face_encoding, photoId);

            newPersonId = result.lastInsertRowid as number;
        } else if (targetPersonId) {
            // Verify target person exists and belongs to user
            const targetPerson = db
                .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
                .get(targetPersonId, req.userId);

            if (!targetPerson) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Target person not found',
                });
            }

            newPersonId = targetPersonId;
        } else {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Must provide targetPersonId or set createNew to true',
            });
        }

        // Move all face detections from this photo to the new person
        for (const detection of faceDetections) {
            db.prepare('UPDATE face_detections SET person_id = ? WHERE id = ?').run(
                newPersonId,
                detection.id
            );
        }

        // Update both people's timestamps
        db.prepare('UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(personId);
        db.prepare('UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            newPersonId
        );

        res.json({ success: true, newPersonId });
    } catch (error) {
        console.error('Reassign photo error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to reassign photo',
        });
    }
});

// Remove a photo from a person (unlink face detection)
router.delete('/:personId/photos/:photoId', authMiddleware, (req: AuthRequest, res) => {
    try {
        const personId = parseInt(req.params.personId);
        const photoId = parseInt(req.params.photoId);

        // Verify person belongs to user
        const person = db
            .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
            .get(personId, req.userId);

        if (!person) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Person not found',
            });
        }

        // Delete face detections for this person in this photo
        db.prepare('DELETE FROM face_detections WHERE person_id = ? AND photo_id = ?').run(
            personId,
            photoId
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Remove photo from person error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to remove photo from person',
        });
    }
});

// Reassign a single face detection to another person
router.post('/faces/:faceDetectionId/reassign', authMiddleware, (req: AuthRequest, res) => {
    try {
        const faceDetectionId = parseInt(req.params.faceDetectionId);
        const { targetPersonId, createNew } = req.body;

        // Get the face detection and verify ownership
        const faceDetection = db
            .prepare(
                `
                    SELECT fd.id, fd.person_id, fd.photo_id, fd.face_encoding, p.user_id
                    FROM face_detections fd
                    LEFT JOIN people p ON fd.person_id = p.id
                    LEFT JOIN photos ph ON fd.photo_id = ph.id
                    WHERE fd.id = ? AND (p.user_id = ? OR ph.user_id = ?)
                    `
            )
            .get(faceDetectionId, req.userId, req.userId) as any;

        if (!faceDetection) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Face detection not found',
            });
        }

        let newPersonId: number;

        if (createNew) {
            // Create new person from this face
            const result = db
                .prepare(
                    'INSERT INTO people (user_id, face_encoding, thumbnail_photo_id) VALUES (?, ?, ?)'
                )
                .run(req.userId, faceDetection.face_encoding, faceDetection.photo_id);

            newPersonId = result.lastInsertRowid as number;

            // Create face thumbnail for new person
            const boundingBoxRow = db
                .prepare('SELECT bounding_box FROM face_detections WHERE id = ?')
                .get(faceDetectionId) as any;

            const boundingBox = JSON.parse(boundingBoxRow.bounding_box);

            // Import createFaceThumbnail from photos route
            // For now, we'll skip this and let it be handled separately
        } else if (targetPersonId) {
            // Verify target person exists and belongs to user
            const targetPerson = db
                .prepare('SELECT id FROM people WHERE id = ? AND user_id = ?')
                .get(targetPersonId, req.userId);

            if (!targetPerson) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Target person not found',
                });
            }

            newPersonId = targetPersonId;
        } else {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Must provide targetPersonId or set createNew to true',
            });
        }

        // Update the face detection
        db.prepare('UPDATE face_detections SET person_id = ? WHERE id = ?').run(
            newPersonId,
            faceDetectionId
        );

        // Update timestamps
        if (faceDetection.person_id) {
            db.prepare('UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
                faceDetection.person_id
            );
        }
        db.prepare('UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            newPersonId
        );

        res.json({ success: true, newPersonId });
    } catch (error) {
        console.error('Reassign face detection error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to reassign face detection',
        });
    }
});

// Remove a single face detection
router.delete('/faces/:faceDetectionId', authMiddleware, (req: AuthRequest, res) => {
    try {
        const faceDetectionId = parseInt(req.params.faceDetectionId);

        // Get the face detection and verify ownership
        const faceDetection = db
            .prepare(
                `
                SELECT fd.id, fd.person_id, p.user_id
                FROM face_detections fd
                LEFT JOIN people p ON fd.person_id = p.id
                LEFT JOIN photos ph ON fd.photo_id = ph.id
                WHERE fd.id = ? AND (p.user_id = ? OR ph.user_id = ?)
                `
            )
            .get(faceDetectionId, req.userId, req.userId) as any;

        if (!faceDetection) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Face detection not found',
            });
        }

        // Delete the face detection
        db.prepare('DELETE FROM face_detections WHERE id = ?').run(faceDetectionId);

        // Update person timestamp if it had a person
        if (faceDetection.person_id) {
            db.prepare('UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
                faceDetection.person_id
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Remove face detection error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to remove face detection',
        });
    }
});

export default router;
