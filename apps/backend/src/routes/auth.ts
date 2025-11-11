import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database';
import { UserRegistration, UserLogin, AuthResponse } from '@photos/shared';

const router = Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, username, password }: UserRegistration = req.body;

        if (!email || !username || !password) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = db
            .prepare('INSERT INTO users (email, username, password) VALUES (?, ?, ?)')
            .run(email, username, hashedPassword);

        const userId = result.lastInsertRowid as number;

        // Get user
        const user = db
            .prepare(
                'SELECT id, email, username, is_whitelisted as isWhitelisted, created_at as createdAt FROM users WHERE id = ?'
            )
            .get(userId) as any;

        // Convert isWhitelisted to boolean
        user.isWhitelisted = user.isWhitelisted === 1;

        // Check if user is admin
        user.isAdmin = user.email === process.env.ADMIN_EMAIL;

        // Generate token
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });

        const response: AuthResponse = {
            user,
            token,
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to register user',
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password }: UserLogin = req.body;

        if (!email || !password) {
            return res
                .status(400)
                .json({ error: 'Bad Request', message: 'Email and password are required' });
        }

        // Get user
        const user = db
            .prepare(
                'SELECT id, email, username, password, is_whitelisted as isWhitelisted, created_at as createdAt FROM users WHERE email = ?'
            )
            .get(email) as any;

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
        }

        // Generate token
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });

        // Remove password from response
        delete user.password;

        // Convert isWhitelisted to boolean
        user.isWhitelisted = user.isWhitelisted === 1;

        // Check if user is admin
        user.isAdmin = user.email === process.env.ADMIN_EMAIL;

        const response: AuthResponse = {
            user,
            token,
        };

        res.json(response);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to login' });
    }
});

// Get current user
router.get('/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, secret) as { userId: number };

        const user = db
            .prepare(
                'SELECT id, email, username, is_whitelisted as isWhitelisted, created_at as createdAt FROM users WHERE id = ?'
            )
            .get(decoded.userId) as any;

        if (!user) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }

        // Convert isWhitelisted to boolean
        user.isWhitelisted = user.isWhitelisted === 1;

        // Check if user is admin
        user.isAdmin = user.email === process.env.ADMIN_EMAIL;

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
});

export default router;
