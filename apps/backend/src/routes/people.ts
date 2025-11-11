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

export default router;
