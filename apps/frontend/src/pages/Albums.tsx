import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Crown, Edit3, Eye } from 'lucide-react';
import { Album, AlbumRole } from '@photos/shared';
import { albumsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Albums() {
    const [albums, setAlbums] = useState<Album[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState('');
    const [newAlbumDescription, setNewAlbumDescription] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        fetchAlbums();
    }, []);

    const fetchAlbums = async () => {
        try {
            const response = await albumsAPI.getAll();
            setAlbums(response.data);
        } catch (error) {
            console.error('Failed to fetch albums:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAlbum = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await albumsAPI.create({
                name: newAlbumName,
                description: newAlbumDescription,
            });
            setShowCreateModal(false);
            setNewAlbumName('');
            setNewAlbumDescription('');
            await fetchAlbums();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to create album');
        }
    };

    const getRoleBadge = (role?: AlbumRole) => {
        if (!role) return null;

        const badges = {
            [AlbumRole.OWNER]: {
                icon: Crown,
                text: 'Owner',
                color: 'bg-purple-100 text-purple-800',
            },
            [AlbumRole.EDITOR]: { icon: Edit3, text: 'Editor', color: 'bg-blue-100 text-blue-800' },
            [AlbumRole.VIEWER]: { icon: Eye, text: 'Viewer', color: 'bg-gray-100 text-gray-800' },
        };

        const badge = badges[role];
        const Icon = badge.icon;

        return (
            <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}
            >
                <Icon className="w-3 h-3" />
                {badge.text}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading albums...</div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Albums</h1>
                {user?.isWhitelisted && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create Album</span>
                    </button>
                )}
            </div>

            {albums.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <FolderOpen className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-600 text-lg mb-2">No albums yet</p>
                    {user?.isWhitelisted ? (
                        <p className="text-gray-500 text-sm">
                            Create your first album to organize photos
                        </p>
                    ) : (
                        <p className="text-gray-500 text-sm">
                            Albums shared with you will appear here
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {albums.map((album) => (
                        <Link
                            key={album.id}
                            to={`/albums/${album.id}`}
                            className="bg-white rounded-lg shadow hover:shadow-lg transition-all p-6 group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0">
                                    <FolderOpen className="w-12 h-12 text-blue-600 group-hover:text-blue-700 transition" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                                            {album.name}
                                        </h3>
                                        {getRoleBadge(album.role)}
                                    </div>
                                    {album.ownerName && album.role !== AlbumRole.OWNER && (
                                        <p className="text-xs text-gray-500 mb-1">
                                            by {album.ownerName}
                                        </p>
                                    )}
                                    {album.description && (
                                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                            {album.description}
                                        </p>
                                    )}
                                    <p className="text-sm text-gray-500 mt-2">
                                        {album.photoCount}{' '}
                                        {album.photoCount === 1 ? 'photo' : 'photos'}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Create Album Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h2 className="text-xl font-semibold mb-4">Create New Album</h2>
                        <form onSubmit={handleCreateAlbum}>
                            <div className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="name"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Album Name
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        required
                                        value={newAlbumName}
                                        onChange={(e) => setNewAlbumName(e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="My Album"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="description"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Description (optional)
                                    </label>
                                    <textarea
                                        id="description"
                                        value={newAlbumDescription}
                                        onChange={(e) => setNewAlbumDescription(e.target.value)}
                                        rows={3}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Album description..."
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewAlbumName('');
                                        setNewAlbumDescription('');
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
