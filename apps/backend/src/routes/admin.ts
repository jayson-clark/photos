import { Router } from 'express';
import db from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

// Get all users with their whitelist status
router.get('/users', (req: AuthRequest, res) => {
    try {
        const users = db
            .prepare(
                `
      SELECT id, email, username, is_whitelisted as isWhitelisted, created_at as createdAt
      FROM users
      ORDER BY created_at DESC
    `
            )
            .all() as any[];

        // Convert isWhitelisted to boolean
        users.forEach((user) => {
            user.isWhitelisted = user.isWhitelisted === 1;
        });

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch users' });
    }
});

// Update user whitelist status
router.patch('/users/:id/whitelist', (req: AuthRequest, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { isWhitelisted } = req.body;

        if (typeof isWhitelisted !== 'boolean') {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'isWhitelisted must be a boolean' });
        }

        // Can't remove whitelist from yourself
        if (userId === req.userId && !isWhitelisted) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'Cannot remove whitelist from yourself' });
        }

        db.prepare('UPDATE users SET is_whitelisted = ? WHERE id = ?').run(
            isWhitelisted ? 1 : 0,
            userId
        );

        const user = db
            .prepare(
                `
      SELECT id, email, username, is_whitelisted as isWhitelisted, created_at as createdAt
      FROM users WHERE id = ?
    `
            )
            .get(userId) as any;

        if (!user) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }

        user.isWhitelisted = user.isWhitelisted === 1;

        res.json(user);
    } catch (error) {
        console.error('Update whitelist error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update whitelist status',
        });
    }
});

export default router;
