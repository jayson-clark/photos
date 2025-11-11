// User types
export interface User {
    id: number;
    email: string;
    username: string;
    isWhitelisted: boolean;
    isAdmin?: boolean;
    createdAt: string;
}

export enum AlbumRole {
    OWNER = 'owner',
    EDITOR = 'editor',
    VIEWER = 'viewer',
}

export interface UserRegistration {
    email: string;
    username: string;
    password: string;
}

export interface UserLogin {
    email: string;
    password: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

// Photo types
export interface Photo {
    id: number;
    userId: number;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    takenAt?: string;
    uploadedAt: string;
    url: string;
    thumbnailUrl?: string;
}

export interface PhotoMetadata {
    id: number;
    photoId: number;
    cameraMake?: string;
    cameraModel?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: number;
    flash?: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    locationName?: string;
    orientation?: number | string;
}

export interface PhotoWithMetadata extends Photo {
    metadata?: PhotoMetadata;
}

export interface PhotoUploadResponse {
    photos: Photo[];
}

// Album types
export interface Album {
    id: number;
    userId: number;
    name: string;
    description?: string;
    coverPhotoId?: number;
    photoCount: number;
    createdAt: string;
    updatedAt: string;
    role?: AlbumRole; // User's role in this album
    ownerName?: string; // Album owner name
}

export interface AlbumWithPhotos extends Album {
    photos: Photo[];
}

export interface AlbumShare {
    id: number;
    albumId: number;
    userId: number;
    role: AlbumRole;
    sharedBy: number;
    createdAt: string;
    // User info returned directly from join
    email?: string;
    username?: string;
}

export interface ShareLink {
    id: number;
    albumId: number;
    token: string;
    createdBy: number;
    expiresAt?: string;
    createdAt: string;
}

export interface ShareAlbumRequest {
    userEmail: string;
    role: AlbumRole;
}

export interface UpdateShareRequest {
    role: AlbumRole;
}

export interface CreateShareLinkRequest {
    expiresInDays?: number;
}

export interface CreateAlbumRequest {
    name: string;
    description?: string;
}

export interface UpdateAlbumRequest {
    name?: string;
    description?: string;
    coverPhotoId?: number;
}

export interface AddPhotosToAlbumRequest {
    photoIds: number[];
}

// People/Face detection types
export interface Person {
    id: number;
    userId: number;
    name?: string;
    thumbnailPhotoId?: number;
    thumbnailUrl?: string;
    photoCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface FaceDetection {
    id: number;
    photoId: number;
    personId?: number;
    faceEncoding: string;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence?: number;
    detectedAt: string;
}

export interface PersonWithPhotos extends Person {
    photos: Photo[];
}

export interface UpdatePersonRequest {
    name: string;
}

// API Response types
export interface ApiError {
    error: string;
    message: string;
}

export interface ApiSuccess<T = any> {
    success: true;
    data: T;
}
