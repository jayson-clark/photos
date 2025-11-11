import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../database';

export interface AuthRequest extends Request {
    userId?: number;
    isWhitelisted?: boolean;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'your-secret-key';

    try {
        const decoded = jwt.verify(token, secret) as { userId: number };
        req.userId = decoded.userId;

        // Get user whitelist status
        const user = db
            .prepare('SELECT is_whitelisted FROM users WHERE id = ?')
            .get(decoded.userId) as { is_whitelisted: number } | undefined;
        req.isWhitelisted = user?.is_whitelisted === 1;

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
}

// Middleware to require whitelisted user
export function requireWhitelisted(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.isWhitelisted) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'This action requires whitelist access',
        });
    }
    next();
}

// Optional auth - doesn't fail if no token, just sets userId if present
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'your-secret-key';

    try {
        const decoded = jwt.verify(token, secret) as { userId: number };
        req.userId = decoded.userId;

        const user = db
            .prepare('SELECT is_whitelisted FROM users WHERE id = ?')
            .get(decoded.userId) as { is_whitelisted: number } | undefined;
        req.isWhitelisted = user?.is_whitelisted === 1;
    } catch (error) {
        // Ignore token errors for optional auth
    }

    next();
}
