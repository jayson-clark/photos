import './nodeUtilPolyfill';
import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs-node';
import canvas from 'canvas';
import path from 'path';
import fs from 'fs';

const { Canvas, Image, ImageData } = canvas;

// Monkey patch for face-api
(faceapi.env as any).monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

// Load face detection models
export async function loadModels() {
    if (modelsLoaded) return;

    const modelsPath = path.join(__dirname, '../../models');

    // Ensure models directory exists
    if (!fs.existsSync(modelsPath)) {
        fs.mkdirSync(modelsPath, { recursive: true });
    }

    try {
        // Set TensorFlow backend
        await tf.ready();

        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath),
            faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
            faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
        ]);

        modelsLoaded = true;
        console.log('✅ Face detection models loaded successfully');
    } catch (error: any) {
        console.error('❌ Error loading face detection models:', error);
        throw error;
    }
}

export interface DetectedFace {
    encoding: number[];
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence: number;
}

// Detect faces in an image file
export async function detectFaces(imagePath: string): Promise<DetectedFace[]> {
    if (!modelsLoaded) {
        console.warn('Face detection models not loaded, skipping face detection');
        return [];
    }

    try {
        // Load image
        const img = await canvas.loadImage(imagePath);
        const imgCanvas = canvas.createCanvas(img.width, img.height);
        const ctx = imgCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Detect faces with landmarks and descriptors
        const detections = await faceapi
            .detectAllFaces(imgCanvas as any)
            .withFaceLandmarks()
            .withFaceDescriptors();

        // Convert to our format
        const faces: DetectedFace[] = detections.map((detection: any) => {
            const box = detection.detection.box;
            return {
                encoding: Array.from(detection.descriptor),
                boundingBox: {
                    x: Math.round(box.x),
                    y: Math.round(box.y),
                    width: Math.round(box.width),
                    height: Math.round(box.height),
                },
                confidence: detection.detection.score,
            };
        });

        return faces;
    } catch (error) {
        console.error('Error detecting faces:', error);
        return [];
    }
}

// Calculate distance between two face encodings (lower is more similar)
export function calculateFaceDistance(encoding1: number[], encoding2: number[]): number {
    if (encoding1.length !== encoding2.length) {
        throw new Error('Face encodings must have the same length');
    }

    // Euclidean distance
    let sum = 0;
    for (let i = 0; i < encoding1.length; i++) {
        const diff = encoding1[i] - encoding2[i];
        sum += diff * diff;
    }

    return Math.sqrt(sum);
}

// Match a face encoding against known people
export function findBestMatch(
    faceEncoding: number[],
    knownEncodings: Array<{ personId: number; encoding: number[] }>,
    threshold: number = 0.6
): number | null {
    if (knownEncodings.length === 0) return null;

    let bestMatch: { personId: number; distance: number } | null = null;

    for (const known of knownEncodings) {
        const distance = calculateFaceDistance(faceEncoding, known.encoding);

        if (distance < threshold && (!bestMatch || distance < bestMatch.distance)) {
            bestMatch = { personId: known.personId, distance };
        }
    }

    return bestMatch ? bestMatch.personId : null;
}
