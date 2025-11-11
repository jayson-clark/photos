import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, UserCircle } from 'lucide-react';
import { peopleAPI } from '../lib/api';
import { PersonWithPhotos } from '@photos/shared';
import PhotoViewer from '../components/PhotoViewer';

export default function PersonDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [person, setPerson] = useState<PersonWithPhotos | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [name, setName] = useState('');

    const handlePhotoNavigate = (photo: any) => {
        if (!person) return;
        const index = person.photos.findIndex((p) => p.id === photo.id);
        if (index !== -1) {
            setSelectedPhotoIndex(index);
        }
    };

    useEffect(() => {
        if (id) {
            loadPerson(parseInt(id));
        }
    }, [id]);

    const loadPerson = async (personId: number) => {
        try {
            setLoading(true);
            const response = await peopleAPI.getById(personId);
            setPerson(response.data);
            setName(response.data.name || '');
        } catch (error) {
            console.error('Failed to load person:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveName = async () => {
        if (!person) return;

        try {
            const response = await peopleAPI.update(person.id, { name });
            setPerson({ ...person, name: response.data.name });
            setEditingName(false);
        } catch (error) {
            console.error('Failed to update person:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!person) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-gray-600">Person not found</p>
                <button
                    onClick={() => navigate('/people')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Back to People
                </button>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate('/people')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to People
                </button>

                <div className="flex items-start gap-6">
                    {/* Thumbnail */}
                    <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {person.thumbnailUrl ? (
                            <img
                                src={`http://localhost:3001${person.thumbnailUrl}`}
                                alt={person.name || 'Unknown'}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <UserCircle className="w-16 h-16 text-gray-400" />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        {editingName ? (
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="text-3xl font-bold px-2 py-1 border border-gray-300 rounded"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSaveName();
                                        } else if (e.key === 'Escape') {
                                            setEditingName(false);
                                            setName(person.name || '');
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSaveName}
                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingName(false);
                                        setName(person.name || '');
                                    }}
                                    className="px-3 py-1 text-gray-700 hover:bg-gray-100 rounded"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900">
                                    {person.name || 'Unknown'}
                                </h1>
                                <button
                                    onClick={() => setEditingName(true)}
                                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        <p className="text-gray-600">
                            {person.photoCount} {person.photoCount === 1 ? 'photo' : 'photos'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Photos Grid */}
            {person.photos.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No photos found</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {person.photos.map((photo, index) => (
                        <div
                            key={photo.id}
                            className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedPhotoIndex(index)}
                        >
                            <img
                                src={`http://localhost:3001${photo.thumbnailUrl || photo.url}`}
                                alt={photo.originalName}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Photo Viewer */}
            {selectedPhotoIndex !== null && person.photos[selectedPhotoIndex] && (
                <PhotoViewer
                    photo={person.photos[selectedPhotoIndex]}
                    photos={person.photos}
                    onClose={() => setSelectedPhotoIndex(null)}
                    onNavigate={handlePhotoNavigate}
                />
            )}
        </div>
    );
}
