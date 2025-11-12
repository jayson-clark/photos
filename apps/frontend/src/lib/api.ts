import axios from 'axios';
import type {
    User,
    Album,
    Photo,
    AlbumWithPhotos,
    PhotoWithMetadata,
    AlbumShare,
    ShareLink,
    AuthResponse,
    UserLogin,
    UserRegistration,
    ShareAlbumRequest,
    UpdateShareRequest,
    CreateShareLinkRequest,
    CreateAlbumRequest,
    UpdateAlbumRequest,
    AddPhotosToAlbumRequest,
    Person,
    PersonWithPhotos,
    UpdatePersonRequest,
    FaceDetectionWithPerson,
} from '@photos/shared';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
    baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auth API
export const authAPI = {
    register: (data: UserRegistration) => api.post<AuthResponse>('/api/auth/register', data),
    login: (data: UserLogin) => api.post<AuthResponse>('/api/auth/login', data),
    me: () => api.get<User>('/api/auth/me'),
};

// Photos API
export const photosAPI = {
    getAll: () => api.get<Photo[]>('/api/photos'),
    getById: (id: number) => api.get<Photo>(`/api/photos/${id}`),
    getMetadata: (id: number) => api.get<PhotoWithMetadata>(`/api/photos/${id}/metadata`),
    getFaces: (id: number) => api.get<FaceDetectionWithPerson[]>(`/api/photos/${id}/faces`),
    upload: (formData: FormData) => api.post<{ photos: Photo[] }>('/api/photos', formData),
    delete: (id: number) => api.delete(`/api/photos/${id}`),
};

// Albums API
export const albumsAPI = {
    getAll: () => api.get<Album[]>('/api/albums'),
    getById: (id: number, token?: string) =>
        api.get<AlbumWithPhotos>(`/api/albums/${id}${token ? `?token=${token}` : ''}`),
    create: (data: CreateAlbumRequest) => api.post<Album>('/api/albums', data),
    update: (id: number, data: UpdateAlbumRequest) => api.put<Album>(`/api/albums/${id}`, data),
    delete: (id: number) => api.delete(`/api/albums/${id}`),
    addPhotos: (id: number, data: AddPhotosToAlbumRequest) =>
        api.post(`/api/albums/${id}/photos`, data),
    removePhoto: (id: number, photoId: number) => api.delete(`/api/albums/${id}/photos/${photoId}`),

    // Sharing
    getShares: (id: number) => api.get<AlbumShare[]>(`/api/albums/${id}/shares`),
    shareWith: (id: number, data: ShareAlbumRequest) =>
        api.post<AlbumShare>(`/api/albums/${id}/shares`, data),
    updateShare: (id: number, shareId: number, data: UpdateShareRequest) =>
        api.patch<AlbumShare>(`/api/albums/${id}/shares/${shareId}`, data),
    removeShare: (id: number, shareId: number) => api.delete(`/api/albums/${id}/shares/${shareId}`),

    // Share links
    getShareLinks: (id: number) => api.get<ShareLink[]>(`/api/albums/${id}/share-links`),
    createShareLink: (id: number, data?: CreateShareLinkRequest) =>
        api.post<ShareLink>(`/api/albums/${id}/share-links`, data || {}),
    deleteShareLink: (id: number, linkId: number) =>
        api.delete(`/api/albums/${id}/share-links/${linkId}`),
};

// Admin API
export const adminAPI = {
    getUsers: () => api.get<User[]>('/api/admin/users'),
    updateWhitelist: (userId: number, isWhitelisted: boolean) =>
        api.patch<User>(`/api/admin/users/${userId}/whitelist`, { isWhitelisted }),
};

// People API
export const peopleAPI = {
    getAll: () => api.get<Person[]>('/api/people'),
    getById: (id: number) => api.get<PersonWithPhotos>(`/api/people/${id}`),
    update: (id: number, data: UpdatePersonRequest) => api.patch<Person>(`/api/people/${id}`, data),
    delete: (id: number) => api.delete(`/api/people/${id}`),
    setThumbnail: (personId: number, photoId: number) =>
        api.post(`/api/people/${personId}/thumbnail/${photoId}`),
    merge: (targetId: number, sourceId: number) =>
        api.post(`/api/people/${targetId}/merge/${sourceId}`),
    reassignPhoto: (personId: number, photoId: number, data: { targetPersonId?: number; createNew?: boolean }) =>
        api.post(`/api/people/${personId}/photos/${photoId}/reassign`, data),
    removePhoto: (personId: number, photoId: number) =>
        api.delete(`/api/people/${personId}/photos/${photoId}`),
    reassignFace: (faceDetectionId: number, data: { targetPersonId?: number; createNew?: boolean }) =>
        api.post(`/api/people/faces/${faceDetectionId}/reassign`, data),
    removeFace: (faceDetectionId: number) =>
        api.delete(`/api/people/faces/${faceDetectionId}`),
};

export default api;
