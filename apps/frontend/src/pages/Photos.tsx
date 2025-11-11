import { useState, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { Photo } from '@photos/shared';
import { photosAPI } from '../lib/api';
import PhotoViewer from '../components/PhotoViewer';
import { useAuth } from '../contexts/AuthContext';

interface PhotosByMonth {
    [key: string]: Photo[];
}

export default function Photos() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        fetchPhotos();
    }, []);

    const fetchPhotos = async () => {
        try {
            const response = await photosAPI.getAll();
            setPhotos(response.data);
        } catch (error) {
            console.error('Failed to fetch photos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append('photos', file);
        });

        try {
            await photosAPI.upload(formData);
            await fetchPhotos();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to upload photos');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDelete = async () => {
        if (!selectedPhoto || !confirm('Are you sure you want to delete this photo?')) return;

        try {
            await photosAPI.delete(selectedPhoto.id);
            setPhotos(photos.filter((p) => p.id !== selectedPhoto.id));
            setSelectedPhoto(null);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to delete photo');
        }
    };

    // Group photos by month
    const photosByMonth: PhotosByMonth = photos.reduce((acc, photo) => {
        const date = new Date(photo.takenAt || photo.uploadedAt);
        const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        if (!acc[monthKey]) {
            acc[monthKey] = [];
        }
        acc[monthKey].push(photo);
        return acc;
    }, {} as PhotosByMonth);

    const monthKeys = Object.keys(photosByMonth).sort((a, b) => {
        return new Date(b).getTime() - new Date(a).getTime();
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading photos...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Photos</h1>
                {user?.isWhitelisted && (
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                        <Upload className="w-5 h-5" />
                        <span>{uploading ? 'Uploading...' : 'Upload Photos'}</span>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                    </label>
                )}
            </div>

            {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <Upload className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-600 text-lg mb-2">No photos yet</p>
                    {user?.isWhitelisted ? (
                        <p className="text-gray-500 text-sm">
                            Upload your first photo to get started
                        </p>
                    ) : (
                        <p className="text-gray-500 text-sm">
                            Photos shared with you will appear here
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-12">
                    {monthKeys.map((monthKey) => (
                        <div key={monthKey}>
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">{monthKey}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                                {photosByMonth[monthKey].map((photo) => (
                                    <div
                                        key={photo.id}
                                        className="relative aspect-square cursor-pointer group"
                                        onClick={() => setSelectedPhoto(photo)}
                                    >
                                        <img
                                            src={`http://localhost:3001${
                                                photo.thumbnailUrl || photo.url
                                            }`}
                                            alt={photo.originalName}
                                            className="w-full h-full object-cover rounded-lg hover:opacity-90 transition"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Photo Viewer */}
            {selectedPhoto && (
                <PhotoViewer
                    photo={selectedPhoto}
                    photos={photos}
                    onClose={() => setSelectedPhoto(null)}
                    onDelete={user?.isWhitelisted ? handleDelete : undefined}
                    onNavigate={setSelectedPhoto}
                />
            )}
        </div>
    );
}
