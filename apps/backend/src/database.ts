import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type BetterSqlite3 from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH || './database.sqlite';
const db: BetterSqlite3.Database = new Database(dbPath);

export function initDatabase() {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create users table
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      is_whitelisted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Create photos table
    db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      taken_at TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    // Create photo_metadata table
    db.exec(`
    CREATE TABLE IF NOT EXISTS photo_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id INTEGER NOT NULL UNIQUE,
      camera_make TEXT,
      camera_model TEXT,
      lens TEXT,
      focal_length TEXT,
      aperture TEXT,
      shutter_speed TEXT,
      iso INTEGER,
      flash TEXT,
      gps_latitude REAL,
      gps_longitude REAL,
      location_name TEXT,
      orientation INTEGER,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
    )
  `);

    // Create albums table
    db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      cover_photo_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL
    )
  `);

    // Create album_photos junction table
    db.exec(`
    CREATE TABLE IF NOT EXISTS album_photos (
      album_id INTEGER NOT NULL,
      photo_id INTEGER NOT NULL,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (album_id, photo_id),
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
    )
  `);

    // Create album_shares table
    db.exec(`
    CREATE TABLE IF NOT EXISTS album_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
      shared_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(album_id, user_id),
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    // Create share_links table
    db.exec(`
    CREATE TABLE IF NOT EXISTS share_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_by INTEGER NOT NULL,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    // Create people table - represents unique individuals detected in photos
    db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT,
      thumbnail_photo_id INTEGER,
      face_thumbnail TEXT,
      face_encoding TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (thumbnail_photo_id) REFERENCES photos(id) ON DELETE SET NULL
    )
  `);

    // Create face_detections table - tracks all face occurrences in photos
    db.exec(`
    CREATE TABLE IF NOT EXISTS face_detections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id INTEGER NOT NULL,
      person_id INTEGER,
      face_encoding TEXT NOT NULL,
      bounding_box TEXT NOT NULL,
      confidence REAL,
      detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    )
  `);

    // Create indexes
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
    CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
    CREATE INDEX IF NOT EXISTS idx_album_photos_album_id ON album_photos(album_id);
    CREATE INDEX IF NOT EXISTS idx_album_photos_photo_id ON album_photos(photo_id);
    CREATE INDEX IF NOT EXISTS idx_album_shares_album_id ON album_shares(album_id);
    CREATE INDEX IF NOT EXISTS idx_album_shares_user_id ON album_shares(user_id);
    CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
    CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
    CREATE INDEX IF NOT EXISTS idx_face_detections_photo_id ON face_detections(photo_id);
    CREATE INDEX IF NOT EXISTS idx_face_detections_person_id ON face_detections(person_id);
  `);

    console.log('✅ Database initialized');

    // Ensure upload directory exists
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const uploadsPath = path.resolve(uploadDir);
    const thumbnailsPath = path.join(uploadsPath, 'thumbnails');

    if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
    }
    if (!fs.existsSync(thumbnailsPath)) {
        fs.mkdirSync(thumbnailsPath, { recursive: true });
    }
}

export default db;
