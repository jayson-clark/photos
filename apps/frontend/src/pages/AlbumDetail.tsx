import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit, Link2, Users2, Copy, Check, X } from 'lucide-react';
import { AlbumWithPhotos, Photo, AlbumRole, AlbumShare, ShareLink } from '@photos/shared';
import { albumsAPI, photosAPI } from '../lib/api';
import PhotoViewer from '../components/PhotoViewer';
import { useAuth } from '../contexts/AuthContext';

export default function AlbumDetail() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const shareToken = searchParams.get('token');
    const { user } = useAuth();

    const [album, setAlbum] = useState<AlbumWithPhotos | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

    // Modal states
    const [showAddPhotos, setShowAddPhotos] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showShareLinkModal, setShowShareLinkModal] = useState(false);

    // Photo management
    const [availablePhotos, setAvailablePhotos] = useState<Photo[]>([]);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);

    // Album editing
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Sharing
    const [shares, setShares] = useState<AlbumShare[]>([]);
    const [shareEmail, setShareEmail] = useState('');
    const [shareRole, setShareRole] = useState<AlbumRole>(AlbumRole.VIEWER);
    const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
    const [linkExpiryDays, setLinkExpiryDays] = useState<number>(30);
    const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);

    useEffect(() => {
        fetchAlbum();
    }, [id]);

    const fetchAlbum = async () => {
        try {
            const response = await albumsAPI.getById(Number(id), shareToken || undefined);
            setAlbum(response.data);
            setEditName(response.data.name);
            setEditDescription(response.data.description || '');
        } catch (error) {
            console.error('Failed to fetch album:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchShares = async () => {
        if (!canManageSharing) return;
        try {
            const response = await albumsAPI.getShares(Number(id));
            setShares(response.data);
        } catch (error) {
            console.error('Failed to fetch shares:', error);
        }
    };

    const fetchShareLinks = async () => {
        if (!canManageSharing) return;
        try {
            const response = await albumsAPI.getShareLinks(Number(id));
            setShareLinks(response.data);
        } catch (error) {
            console.error('Failed to fetch share links:', error);
        }
    };

    const fetchAvailablePhotos = async () => {
        try {
            const response = await photosAPI.getAll();
            setAvailablePhotos(response.data);
        } catch (error) {
            console.error('Failed to fetch photos:', error);
        }
    };

    const handleAddPhotos = async () => {
        if (selectedPhotoIds.length === 0) return;
        try {
            await albumsAPI.addPhotos(Number(id), { photoIds: selectedPhotoIds });
            setShowAddPhotos(false);
            setSelectedPhotoIds([]);
            await fetchAlbum();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to add photos');
        }
    };

    const handleRemovePhoto = async (photoId: number) => {
        if (!confirm('Remove this photo from the album?')) return;
        try {
            await albumsAPI.removePhoto(Number(id), photoId);
            await fetchAlbum();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to remove photo');
        }
    };

    const handleUpdateAlbum = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await albumsAPI.update(Number(id), {
                name: editName,
                description: editDescription,
            });
            setShowEditModal(false);
            await fetchAlbum();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to update album');
        }
    };

    const handleDeleteAlbum = async () => {
        if (!confirm('Are you sure you want to delete this album? Photos will not be deleted.'))
            return;
        try {
            await albumsAPI.delete(Number(id));
            navigate('/albums');
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to delete album');
        }
    };

    const handleShareWithUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await albumsAPI.shareWith(Number(id), { userEmail: shareEmail, role: shareRole });
            setShareEmail('');
            setShareRole(AlbumRole.VIEWER);
            await fetchShares();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to share album');
        }
    };

    const handleUpdateShare = async (shareId: number, role: AlbumRole) => {
        try {
            await albumsAPI.updateShare(Number(id), shareId, { role });
            await fetchShares();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to update share');
        }
    };

    const handleRemoveShare = async (shareId: number) => {
        if (!confirm("Remove this user's access?")) return;
        try {
            await albumsAPI.removeShare(Number(id), shareId);
            await fetchShares();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to remove share');
        }
    };

    const handleCreateShareLink = async () => {
        try {
            await albumsAPI.createShareLink(Number(id), { expiresInDays: linkExpiryDays });
            setLinkExpiryDays(30);
            await fetchShareLinks();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to create share link');
        }
    };

    const handleDeleteShareLink = async (linkId: number) => {
        if (!confirm('Delete this share link?')) return;
        try {
            await albumsAPI.deleteShareLink(Number(id), linkId);
            await fetchShareLinks();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to delete share link');
        }
    };

    const copyShareLink = (token: string, linkId: number) => {
        const url = `${window.location.origin}/albums/${id}?token=${token}`;
        navigator.clipboard.writeText(url);
        setCopiedLinkId(linkId);
        setTimeout(() => setCopiedLinkId(null), 2000);
    };

    const canEdit = album?.role === AlbumRole.OWNER || album?.role === AlbumRole.EDITOR;
    const canManageSharing = album?.role === AlbumRole.OWNER;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading album...</div>
            </div>
        );
    }

    if (!album) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <p className="text-gray-600 text-lg mb-4">Album not found</p>
                <button
                    onClick={() => navigate(user ? '/albums' : '/login')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    {user ? 'Back to Albums' : 'Login'}
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 min-h-screen bg-gray-50">
            <button
                onClick={() => navigate('/albums')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Albums</span>
            </button>

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{album.name}</h1>
                    {album.description && <p className="text-gray-600 mt-2">{album.description}</p>}
                    <div className="flex items-center gap-4 mt-3">
                        <p className="text-sm text-gray-500">
                            {album.photos.length} {album.photos.length === 1 ? 'photo' : 'photos'}
                        </p>
                        {album.ownerName && album.role !== AlbumRole.OWNER && (
                            <p className="text-sm text-gray-500">by {album.ownerName}</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {canManageSharing && (
                        <>
                            <button
                                onClick={() => {
                                    fetchShares();
                                    setShowShareModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Users2 className="w-5 h-5" />
                                <span>Share</span>
                            </button>
                            <button
                                onClick={() => {
                                    fetchShareLinks();
                                    setShowShareLinkModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Link2 className="w-5 h-5" />
                                <span>Links</span>
                            </button>
                        </>
                    )}
                    {canEdit && (
                        <>
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Edit className="w-5 h-5" />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={() => {
                                    fetchAvailablePhotos();
                                    setShowAddPhotos(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add Photos</span>
                            </button>
                        </>
                    )}
                    {canManageSharing && (
                        <button
                            onClick={handleDeleteAlbum}
                            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span>Delete</span>
                        </button>
                    )}
                </div>
            </div>

            {album.photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-600 text-lg mb-4">No photos in this album yet</p>
                    {canEdit && (
                        <button
                            onClick={() => {
                                fetchAvailablePhotos();
                                setShowAddPhotos(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Add Photos</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                    {album.photos.map((photo) => (
                        <div
                            key={photo.id}
                            className="relative aspect-square cursor-pointer group"
                            onClick={() => setSelectedPhoto(photo)}
                        >
                            <img
                                src={`http://localhost:3001${photo.thumbnailUrl || photo.url}`}
                                alt={photo.originalName}
                                className="w-full h-full object-cover rounded-lg hover:opacity-90 transition"
                            />
                            {canEdit && (
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition rounded-lg pointer-events-none">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition pointer-events-auto">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemovePhoto(photo.id);
                                            }}
                                            className="p-2 bg-white rounded-full shadow hover:bg-red-50"
                                            title="Remove from album"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Photo Viewer */}
            {selectedPhoto && (
                <PhotoViewer
                    photo={selectedPhoto}
                    photos={album.photos}
                    onClose={() => setSelectedPhoto(null)}
                    onDelete={
                        canEdit
                            ? async () => {
                                  await handleRemovePhoto(selectedPhoto.id);
                                  setSelectedPhoto(null);
                              }
                            : undefined
                    }
                    onNavigate={setSelectedPhoto}
                />
            )}

            {/* Add Photos Modal */}
            {showAddPhotos && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Add Photos to Album</h2>
                            <button
                                onClick={() => {
                                    setShowAddPhotos(false);
                                    setSelectedPhotoIds([]);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
                                {availablePhotos.map((photo) => {
                                    const isSelected = selectedPhotoIds.includes(photo.id);
                                    const isAlreadyInAlbum = album.photos.some(
                                        (p) => p.id === photo.id
                                    );
                                    return (
                                        <div
                                            key={photo.id}
                                            className={`relative cursor-pointer ${
                                                isAlreadyInAlbum
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : ''
                                            }`}
                                            onClick={() => {
                                                if (isAlreadyInAlbum) return;
                                                setSelectedPhotoIds(
                                                    isSelected
                                                        ? selectedPhotoIds.filter(
                                                              (id) => id !== photo.id
                                                          )
                                                        : [...selectedPhotoIds, photo.id]
                                                );
                                            }}
                                        >
                                            <img
                                                src={`http://localhost:3001${
                                                    photo.thumbnailUrl || photo.url
                                                }`}
                                                alt={photo.originalName}
                                                className="w-full h-32 object-cover rounded-lg"
                                            />
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-blue-600/50 flex items-center justify-center rounded-lg">
                                                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                                                        <Check className="w-5 h-5 text-blue-600" />
                                                    </div>
                                                </div>
                                            )}
                                            {isAlreadyInAlbum && (
                                                <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center rounded-lg">
                                                    <span className="text-white text-xs font-medium">
                                                        In Album
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowAddPhotos(false);
                                        setSelectedPhotoIds([]);
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddPhotos}
                                    disabled={selectedPhotoIds.length === 0}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add {selectedPhotoIds.length}{' '}
                                    {selectedPhotoIds.length === 1 ? 'Photo' : 'Photos'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Album Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h2 className="text-xl font-semibold mb-4">Edit Album</h2>
                        <form onSubmit={handleUpdateAlbum}>
                            <div className="space-y-4">
                                <div>
                                    <label
                                        htmlFor="edit-name"
                                        className="block text-sm font-medium text-gray-700 mb-1"
                                    >
                                        Album Name
                                    </label>
                                    <input
                                        type="text"
                                        id="edit-name"
                                        required
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="edit-description"
                                        className="block text-sm font-medium text-gray-700 mb-1"
                                    >
                                        Description
                                    </label>
                                    <textarea
                                        id="edit-description"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Share with Users Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Share Album</h2>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            {/* Add user form */}
                            <form onSubmit={handleShareWithUser} className="mb-6">
                                <div className="flex gap-3">
                                    <input
                                        type="email"
                                        placeholder="Enter user email"
                                        value={shareEmail}
                                        onChange={(e) => setShareEmail(e.target.value)}
                                        required
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <select
                                        value={shareRole}
                                        onChange={(e) => setShareRole(e.target.value as AlbumRole)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value={AlbumRole.VIEWER}>Viewer</option>
                                        <option value={AlbumRole.EDITOR}>Editor</option>
                                    </select>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Share
                                    </button>
                                </div>
                            </form>

                            {/* List of shared users */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                    Shared with
                                </h3>
                                {shares.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-8">
                                        This album hasn't been shared with anyone yet
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {shares.map((share) => (
                                            <div
                                                key={share.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                            >
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900">
                                                        {share.username}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {share.email}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={share.role}
                                                        onChange={(e) =>
                                                            handleUpdateShare(
                                                                share.id,
                                                                e.target.value as AlbumRole
                                                            )
                                                        }
                                                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value={AlbumRole.VIEWER}>
                                                            Viewer
                                                        </option>
                                                        <option value={AlbumRole.EDITOR}>
                                                            Editor
                                                        </option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleRemoveShare(share.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="Remove access"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Links Modal */}
            {showShareLinkModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Share Links</h2>
                            <button
                                onClick={() => setShowShareLinkModal(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6">
                            {/* Create link form */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                    Create New Link
                                </h3>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-sm text-gray-600 mb-1">
                                            Expires in (days)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            value={linkExpiryDays}
                                            onChange={(e) =>
                                                setLinkExpiryDays(parseInt(e.target.value))
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <button
                                        onClick={handleCreateShareLink}
                                        className="self-end px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Create Link
                                    </button>
                                </div>
                            </div>

                            {/* List of links */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                                    Active Links
                                </h3>
                                {shareLinks.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-8">
                                        No share links created yet
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {shareLinks.map((link) => (
                                            <div
                                                key={link.id}
                                                className="p-4 bg-gray-50 rounded-lg"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1 mr-4">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Link2 className="w-4 h-4 text-gray-400" />
                                                            <p className="text-sm font-medium text-gray-900">
                                                                Share Link
                                                            </p>
                                                        </div>
                                                        <p className="text-xs text-gray-500">
                                                            Created{' '}
                                                            {new Date(
                                                                link.createdAt
                                                            ).toLocaleDateString()}
                                                            {link.expiresAt && (
                                                                <span>
                                                                    {' '}
                                                                    • Expires{' '}
                                                                    {new Date(
                                                                        link.expiresAt
                                                                    ).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() =>
                                                            handleDeleteShareLink(link.id)
                                                        }
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="Delete link"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={`${window.location.origin}/albums/${id}?token=${link.token}`}
                                                        className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg"
                                                    />
                                                    <button
                                                        onClick={() =>
                                                            copyShareLink(link.token, link.id)
                                                        }
                                                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
                                                    >
                                                        {copiedLinkId === link.id ? (
                                                            <>
                                                                <Check className="w-4 h-4" />
                                                                <span>Copied!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-4 h-4" />
                                                                <span>Copy</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
