import { Router } from 'express';
import { authMiddleware, requireWhitelisted, optionalAuth, AuthRequest } from '../middleware/auth';
import db from '../database';
import {
    Album,
    AlbumWithPhotos,
    CreateAlbumRequest,
    UpdateAlbumRequest,
    AddPhotosToAlbumRequest,
    AlbumRole,
    ShareAlbumRequest,
    UpdateShareRequest,
    CreateShareLinkRequest,
} from '@photos/shared';
import crypto from 'crypto';

const router = Router();

// Helper function to get user's role in an album
function getUserAlbumRole(albumId: number, userId: number | undefined): AlbumRole | null {
    if (!userId) return null;

    // Check if user is owner
    const album = db.prepare('SELECT user_id FROM albums WHERE id = ?').get(albumId) as
        | { user_id: number }
        | undefined;
    if (album?.user_id === userId) {
        return AlbumRole.OWNER;
    }

    // Check if user has been shared the album
    const share = db
        .prepare('SELECT role FROM album_shares WHERE album_id = ? AND user_id = ?')
        .get(albumId, userId) as { role: string } | undefined;

    return share ? (share.role as AlbumRole) : null;
}

// Helper function to check if user can view album
function canViewAlbum(albumId: number, userId: number | undefined): boolean {
    const role = getUserAlbumRole(albumId, userId);
    return role !== null;
}

// Helper function to check if user can edit album
function canEditAlbum(albumId: number, userId: number | undefined): boolean {
    if (!userId) return false;
    const role = getUserAlbumRole(albumId, userId);
    return role === AlbumRole.OWNER || role === AlbumRole.EDITOR;
}

// Helper function to check if user owns album
function ownsAlbum(albumId: number, userId: number | undefined): boolean {
    if (!userId) return false;
    const role = getUserAlbumRole(albumId, userId);
    return role === AlbumRole.OWNER;
}

// Get all albums for user (owned + shared with them)
router.get('/', authMiddleware, (req: AuthRequest, res) => {
    try {
        // Get owned albums
        const ownedAlbums = db
            .prepare(
                `
      SELECT 
        a.id,
        a.user_id as userId,
        a.name,
        a.description,
        a.cover_photo_id as coverPhotoId,
        a.created_at as createdAt,
        a.updated_at as updatedAt,
        COUNT(ap.photo_id) as photoCount,
        'owner' as role,
        u.username as ownerName
      FROM albums a
      LEFT JOIN album_photos ap ON a.id = ap.album_id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.user_id = ?
      GROUP BY a.id
    `
            )
            .all(req.userId) as Album[];

        // Get shared albums
        const sharedAlbums = db
            .prepare(
                `
      SELECT 
        a.id,
        a.user_id as userId,
        a.name,
        a.description,
        a.cover_photo_id as coverPhotoId,
        a.created_at as createdAt,
        a.updated_at as updatedAt,
        COUNT(ap.photo_id) as photoCount,
        ash.role,
        u.username as ownerName
      FROM albums a
      INNER JOIN album_shares ash ON a.id = ash.album_id
      LEFT JOIN album_photos ap ON a.id = ap.album_id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE ash.user_id = ?
      GROUP BY a.id
    `
            )
            .all(req.userId) as Album[];

        const allAlbums = [...ownedAlbums, ...sharedAlbums].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        res.json(allAlbums);
    } catch (error) {
        console.error('Get albums error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get albums' });
    }
});

// Create album (requires whitelist)
router.post('/', authMiddleware, requireWhitelisted, (req: AuthRequest, res) => {
    try {
        const { name, description }: CreateAlbumRequest = req.body;

        if (!name) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'Album name is required' });
        }

        const result = db
            .prepare(
                `
      INSERT INTO albums (user_id, name, description)
      VALUES (?, ?, ?)
    `
            )
            .run(req.userId, name, description || null);

        const albumId = result.lastInsertRowid as number;

        const album = db
            .prepare(
                `
      SELECT 
        a.id,
        a.user_id as userId,
        a.name,
        a.description,
        a.cover_photo_id as coverPhotoId,
        a.created_at as createdAt,
        a.updated_at as updatedAt,
        0 as photoCount,
        'owner' as role,
        u.username as ownerName
      FROM albums a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `
            )
            .get(albumId) as Album;

        res.status(201).json(album);
    } catch (error) {
        console.error('Create album error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create album' });
    }
});

// Get album by ID with photos (supports share links via query param)
router.get('/:id', optionalAuth, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);
        const shareToken = req.query.token as string | undefined;

        // Check if accessing via share link
        if (shareToken) {
            const shareLink = db
                .prepare(
                    `
        SELECT id, album_id, expires_at
        FROM share_links
        WHERE token = ? AND album_id = ?
      `
                )
                .get(shareToken, albumId) as
                | { id: number; album_id: number; expires_at: string | null }
                | undefined;

            if (!shareLink) {
                return res.status(404).json({ error: 'Not Found', message: 'Invalid share link' });
            }

            // Check if link is expired
            if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
                return res
                    .status(403)
                    .json({ error: 'Forbidden', message: 'Share link has expired' });
            }
        } else {
            // Check if user has permission to view album
            if (!canViewAlbum(albumId, req.userId)) {
                return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
            }
        }

        const userRole = req.userId ? getUserAlbumRole(albumId, req.userId) : AlbumRole.VIEWER;

        const album = db
            .prepare(
                `
      SELECT 
        a.id,
        a.user_id as userId,
        a.name,
        a.description,
        a.cover_photo_id as coverPhotoId,
        a.created_at as createdAt,
        a.updated_at as updatedAt,
        COUNT(ap.photo_id) as photoCount,
        u.username as ownerName
      FROM albums a
      LEFT JOIN album_photos ap ON a.id = ap.album_id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
      GROUP BY a.id
    `
            )
            .get(albumId) as Album | undefined;

        if (!album) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        album.role = userRole || undefined;

        // Get photos in album with metadata
        const photos = db
            .prepare(
                `
      SELECT 
        p.id,
        p.user_id as userId,
        p.filename,
        p.original_name as originalName,
        p.mime_type as mimeType,
        p.size,
        p.width,
        p.height,
        p.taken_at as takenAt,
        p.uploaded_at as uploadedAt
      FROM photos p
      INNER JOIN album_photos ap ON p.id = ap.photo_id
      WHERE ap.album_id = ?
      ORDER BY p.taken_at DESC, ap.added_at DESC
    `
            )
            .all(albumId) as any[];

        const photosWithUrls = photos.map((photo) => ({
            ...photo,
            url: `/uploads/${photo.filename}`,
            thumbnailUrl: `/uploads/thumbnails/${photo.filename}`,
        }));

        const albumWithPhotos: AlbumWithPhotos = {
            ...album,
            photos: photosWithUrls,
        };

        res.json(albumWithPhotos);
    } catch (error) {
        console.error('Get album error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get album' });
    }
});

// Update album (requires owner or editor)
router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
    try {
        const { name, description, coverPhotoId }: UpdateAlbumRequest = req.body;
        const albumId = parseInt(req.params.id);

        if (!canEditAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (coverPhotoId !== undefined) {
            updates.push('cover_photo_id = ?');
            values.push(coverPhotoId);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(albumId);

        db.prepare(
            `
      UPDATE albums
      SET ${updates.join(', ')}
      WHERE id = ?
    `
        ).run(...values);

        const updatedAlbum = db
            .prepare(
                `
      SELECT 
        a.id,
        a.user_id as userId,
        a.name,
        a.description,
        a.cover_photo_id as coverPhotoId,
        a.created_at as createdAt,
        a.updated_at as updatedAt,
        COUNT(ap.photo_id) as photoCount,
        u.username as ownerName
      FROM albums a
      LEFT JOIN album_photos ap ON a.id = ap.album_id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
      GROUP BY a.id
    `
            )
            .get(albumId) as Album;

        updatedAlbum.role = getUserAlbumRole(albumId, req.userId) || undefined;

        res.json(updatedAlbum);
    } catch (error) {
        console.error('Update album error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update album' });
    }
});

// Delete album (requires owner only)
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        db.prepare('DELETE FROM albums WHERE id = ?').run(albumId);

        res.json({ success: true, message: 'Album deleted successfully' });
    } catch (error) {
        console.error('Delete album error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete album' });
    }
});

// Add photos to album (requires owner or editor, and user must be whitelisted)
router.post('/:id/photos', authMiddleware, requireWhitelisted, (req: AuthRequest, res) => {
    try {
        const { photoIds }: AddPhotosToAlbumRequest = req.body;
        const albumId = parseInt(req.params.id);

        if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'Photo IDs are required' });
        }

        if (!canEditAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        // Verify all photos belong to the user
        const placeholders = photoIds.map(() => '?').join(',');
        const photos = db
            .prepare(
                `
      SELECT id FROM photos WHERE id IN (${placeholders}) AND user_id = ?
    `
            )
            .all(...photoIds, req.userId) as any[];

        if (photos.length !== photoIds.length) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Some photos not found or not owned by user',
            });
        }

        // Insert photos into album (ignore duplicates)
        const insertStmt = db.prepare(
            'INSERT OR IGNORE INTO album_photos (album_id, photo_id) VALUES (?, ?)'
        );
        const insertMany = db.transaction((photoIds: number[]) => {
            for (const photoId of photoIds) {
                insertStmt.run(albumId, photoId);
            }
        });

        insertMany(photoIds);

        // Update album's updated_at timestamp
        db.prepare('UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(albumId);

        res.json({ success: true, message: 'Photos added to album' });
    } catch (error) {
        console.error('Add photos to album error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to add photos to album',
        });
    }
});

// Remove photo from album (requires owner or editor)
router.delete('/:id/photos/:photoId', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);

        if (!canEditAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        db.prepare('DELETE FROM album_photos WHERE album_id = ? AND photo_id = ?').run(
            albumId,
            req.params.photoId
        );

        // Update album's updated_at timestamp
        db.prepare('UPDATE albums SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(albumId);

        res.json({ success: true, message: 'Photo removed from album' });
    } catch (error) {
        console.error('Remove photo from album error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to remove photo from album',
        });
    }
});

// ========== SHARING ROUTES ==========

// Get album shares
router.get('/:id/shares', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        const shares = db
            .prepare(
                `
      SELECT 
        ash.id,
        ash.album_id as albumId,
        ash.user_id as userId,
        ash.role,
        ash.shared_by as sharedBy,
        ash.created_at as createdAt,
        u.email,
        u.username
      FROM album_shares ash
      JOIN users u ON ash.user_id = u.id
      WHERE ash.album_id = ?
      ORDER BY ash.created_at DESC
    `
            )
            .all(albumId) as any[];

        res.json(shares);
    } catch (error) {
        console.error('Get shares error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get shares' });
    }
});

// Share album with user
router.post('/:id/shares', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);
        const { userEmail, role }: ShareAlbumRequest = req.body;

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        if (!userEmail || !role) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'User email and role are required' });
        }

        // Find user by email
        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(userEmail) as
            | { id: number }
            | undefined;
        if (!user) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }

        // Can't share with yourself
        if (user.id === req.userId) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'Cannot share album with yourself' });
        }

        // Insert or update share
        db.prepare(
            `
      INSERT INTO album_shares (album_id, user_id, role, shared_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(album_id, user_id) DO UPDATE SET role = excluded.role
    `
        ).run(albumId, user.id, role, req.userId);

        const share = db
            .prepare(
                `
      SELECT 
        ash.id,
        ash.album_id as albumId,
        ash.user_id as userId,
        ash.role,
        ash.shared_by as sharedBy,
        ash.created_at as createdAt,
        u.email,
        u.username
      FROM album_shares ash
      JOIN users u ON ash.user_id = u.id
      WHERE ash.album_id = ? AND ash.user_id = ?
    `
            )
            .get(albumId, user.id);

        res.status(201).json(share);
    } catch (error) {
        console.error('Share album error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to share album' });
    }
});

// Update share role
router.patch('/:id/shares/:shareId', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);
        const shareId = parseInt(req.params.shareId);
        const { role }: UpdateShareRequest = req.body;

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        if (!role) {
            return res.status(400).json({ error: 'Bad Request', message: 'Role is required' });
        }

        db.prepare('UPDATE album_shares SET role = ? WHERE id = ? AND album_id = ?').run(
            role,
            shareId,
            albumId
        );

        const share = db
            .prepare(
                `
      SELECT 
        ash.id,
        ash.album_id as albumId,
        ash.user_id as userId,
        ash.role,
        ash.shared_by as sharedBy,
        ash.created_at as createdAt,
        u.email,
        u.username
      FROM album_shares ash
      JOIN users u ON ash.user_id = u.id
      WHERE ash.id = ?
    `
            )
            .get(shareId);

        res.json(share);
    } catch (error) {
        console.error('Update share error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update share' });
    }
});

// Remove share
router.delete('/:id/shares/:shareId', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);
        const shareId = parseInt(req.params.shareId);

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        db.prepare('DELETE FROM album_shares WHERE id = ? AND album_id = ?').run(shareId, albumId);

        res.json({ success: true, message: 'Share removed' });
    } catch (error) {
        console.error('Remove share error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove share' });
    }
});

// Get share links for album
router.get('/:id/share-links', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        const links = db
            .prepare(
                `
      SELECT 
        id,
        album_id as albumId,
        token,
        created_by as createdBy,
        expires_at as expiresAt,
        created_at as createdAt
      FROM share_links
      WHERE album_id = ?
      ORDER BY created_at DESC
    `
            )
            .all(albumId);

        res.json(links);
    } catch (error) {
        console.error('Get share links error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get share links',
        });
    }
});

// Create share link
router.post('/:id/share-links', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);
        const { expiresInDays }: CreateShareLinkRequest = req.body;

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        // Generate random token
        const token = crypto.randomBytes(32).toString('hex');

        // Calculate expiration date if specified
        let expiresAt = null;
        if (expiresInDays && expiresInDays > 0) {
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + expiresInDays);
            expiresAt = expDate.toISOString();
        }

        const result = db
            .prepare(
                `
      INSERT INTO share_links (album_id, token, created_by, expires_at)
      VALUES (?, ?, ?, ?)
    `
            )
            .run(albumId, token, req.userId, expiresAt);

        const link = db
            .prepare(
                `
      SELECT 
        id,
        album_id as albumId,
        token,
        created_by as createdBy,
        expires_at as expiresAt,
        created_at as createdAt
      FROM share_links
      WHERE id = ?
    `
            )
            .get(result.lastInsertRowid);

        res.status(201).json(link);
    } catch (error) {
        console.error('Create share link error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create share link',
        });
    }
});

// Delete share link
router.delete('/:id/share-links/:linkId', authMiddleware, (req: AuthRequest, res) => {
    try {
        const albumId = parseInt(req.params.id);
        const linkId = parseInt(req.params.linkId);

        if (!ownsAlbum(albumId, req.userId)) {
            return res.status(404).json({ error: 'Not Found', message: 'Album not found' });
        }

        db.prepare('DELETE FROM share_links WHERE id = ? AND album_id = ?').run(linkId, albumId);

        res.json({ success: true, message: 'Share link deleted' });
    } catch (error) {
        console.error('Delete share link error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete share link',
        });
    }
});

export default router;
