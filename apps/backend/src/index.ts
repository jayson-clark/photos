import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDatabase } from './database';
import { loadModels } from './utils/faceDetection';
import authRouter from './routes/auth';
import photosRouter from './routes/photos';
import albumsRouter from './routes/albums';
import adminRouter from './routes/admin';
import peopleRouter from './routes/people';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Serve face thumbnails
const facesDir = path.join(path.resolve(uploadDir), 'faces');
app.use('/uploads/faces', express.static(facesDir));

// Initialize database and face detection models
initDatabase();
loadModels().catch((err) => console.error('Failed to load face detection models:', err));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/photos', photosRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/people', peopleRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
