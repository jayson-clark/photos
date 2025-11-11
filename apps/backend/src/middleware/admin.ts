import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Middleware to require admin user (specified in .env)
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
        return res.status(500).json({
            error: 'Server Error',
            message: 'Admin email not configured',
        });
    }

    // Get user email from database
    const db = require('../database').default;
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId) as
        | { email: string }
        | undefined;

    if (!user || user.email !== adminEmail) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required',
        });
    }

    next();
}
