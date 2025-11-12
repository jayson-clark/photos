#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '../models');
const BASE_URL = 'https://vladmandic.github.io/face-api/model/';

const MODELS = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model.bin',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model.bin',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model.bin',
];

// Ensure models directory exists
if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https
            .get(url, (response) => {
                if (response.statusCode === 200) {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                } else {
                    fs.unlink(dest, () => {});
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                }
            })
            .on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
    });
}

async function downloadModels() {
    console.log('📥 Downloading face detection models...');

    for (const model of MODELS) {
        const url = BASE_URL + model;
        const dest = path.join(MODELS_DIR, model);

        // Skip if already exists
        if (fs.existsSync(dest)) {
            console.log(`✓ ${model} (already exists)`);
            continue;
        }

        try {
            await downloadFile(url, dest);
            console.log(`✓ ${model}`);
        } catch (error) {
            console.error(`✗ ${model}: ${error.message}`);
            process.exit(1);
        }
    }

    console.log('\n✅ All models downloaded successfully!');
}

downloadModels();
