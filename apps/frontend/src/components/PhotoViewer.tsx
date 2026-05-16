import { useEffect, useState, useRef } from 'react';
import {
    X,
    Info,
    Trash2,
    Download,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Calendar,
    Image as ImageIcon,
    Upload,
    Camera,
    Settings,
    FileText,
    Users,
    UserCircle,
    UserPlus,
    Trash,
} from 'lucide-react';
import { Photo, PhotoMetadata, FaceDetectionWithPerson, Person } from '@photos/shared';
import { photosAPI, peopleAPI } from '../lib/api';

interface PhotoViewerProps {
    photo: Photo;
    photos?: Photo[];
    onClose: () => void;
    onDelete?: () => void;
    onNavigate?: (photo: Photo) => void;
}

export default function PhotoViewer({
    photo,
    photos = [],
    onClose,
    onDelete,
    onNavigate,
}: PhotoViewerProps) {
    const [showInfo, setShowInfo] = useState(false);
    const [metadata, setMetadata] = useState<PhotoMetadata | null>(null);
    const [loadingMetadata, setLoadingMetadata] = useState(false);
    const [faceDetections, setFaceDetections] = useState<FaceDetectionWithPerson[]>([]);
    const [showFaces, setShowFaces] = useState(false);
    const [selectedFace, setSelectedFace] = useState<number | null>(null);
    const [allPeople, setAllPeople] = useState<Person[]>([]);
    const [managingFace, setManagingFace] = useState<FaceDetectionWithPerson | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [imageScale, setImageScale] = useState({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 });

    const currentIndex = photos.findIndex((p) => p.id === photo.id);
    const canNavigate = photos.length > 1;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && canNavigate) handlePrevious();
            if (e.key === 'ArrowRight' && canNavigate) handleNext();
            if (e.key === 'i') setShowInfo((prev) => !prev);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [photo, canNavigate]);

    // Reset metadata and faces when photo changes
    useEffect(() => {
        setMetadata(null);
        setLoadingMetadata(false);
        setFaceDetections([]);
        setShowFaces(false);
        setSelectedFace(null);
        setManagingFace(null);
        if (showInfo) {
            loadMetadata();
            loadFaceDetections();
        }
    }, [photo.id]);

    useEffect(() => {
        if (showInfo) {
            if (!metadata && !loadingMetadata) {
                loadMetadata();
            }
            if (faceDetections.length === 0) {
                loadFaceDetections();
            }
        }
    }, [showInfo]);

    // Calculate image scale when image loads or window resizes
    useEffect(() => {
        const calculateScale = () => {
            if (!imageRef.current) return;
            const img = imageRef.current;
            const container = img.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const scaleX = containerRect.width / img.naturalWidth;
            const scaleY = containerRect.height / img.naturalHeight;
            const scale = Math.min(scaleX, scaleY);

            const displayWidth = img.naturalWidth * scale;
            const displayHeight = img.naturalHeight * scale;
            const offsetX = (containerRect.width - displayWidth) / 2;
            const offsetY = (containerRect.height - displayHeight) / 2;

            setImageScale({
                scaleX: scale,
                scaleY: scale,
                offsetX,
                offsetY,
            });
        };

        const img = imageRef.current;
        if (img) {
            if (img.complete) {
                calculateScale();
            } else {
                img.onload = calculateScale;
            }
        }

        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, [photo.id, showFaces]);

    const loadMetadata = async () => {
        try {
            setLoadingMetadata(true);
            const response = await photosAPI.getMetadata(photo.id);
            setMetadata(response.data.metadata || null);
        } catch (error) {
            console.error('Failed to load metadata:', error);
        } finally {
            setLoadingMetadata(false);
        }
    };

    const loadFaceDetections = async () => {
        try {
            const response = await photosAPI.getFaces(photo.id);
            setFaceDetections(response.data);
        } catch (error) {
            console.error('Failed to load face detections:', error);
        }
    };

    const loadAllPeople = async () => {
        try {
            const response = await peopleAPI.getAll();
            setAllPeople(response.data);
        } catch (error) {
            console.error('Failed to load all people:', error);
        }
    };

    const handleReassignFace = async (faceId: number, targetPersonId?: number) => {
        try {
            if (targetPersonId) {
                await peopleAPI.reassignFace(faceId, { targetPersonId });
            } else {
                await peopleAPI.reassignFace(faceId, { createNew: true });
            }
            await loadFaceDetections();
            await loadAllPeople();
            setManagingFace(null);
        } catch (error) {
            console.error('Failed to reassign face:', error);
            alert('Failed to reassign face. Please try again.');
        }
    };

    const handleRemoveFace = async (faceId: number) => {
        if (!confirm('Remove this face detection? The photo will not be deleted.')) {
            return;
        }

        try {
            await peopleAPI.removeFace(faceId);
            await loadFaceDetections();
            setManagingFace(null);
            setShowFaces(false);
        } catch (error) {
            console.error('Failed to remove face:', error);
            alert('Failed to remove face. Please try again.');
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0 && onNavigate) {
            onNavigate(photos[currentIndex - 1]);
        }
    };

    const handleNext = () => {
        if (currentIndex < photos.length - 1 && onNavigate) {
            onNavigate(photos[currentIndex + 1]);
        }
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = `${photo.url}`;
        link.download = photo.originalName;
        link.click();
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex">
            {/* Main viewer area */}
            <div className={`flex-1 relative transition-all duration-300 ${showInfo ? '' : ''}`}>
                {/* Overlay controls - Top */}
                <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={onClose}
                            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                            title="Close (Esc)"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                className={`p-2 text-white hover:bg-white/20 rounded-lg transition-colors ${
                                    showInfo ? 'bg-white/20' : ''
                                }`}
                                title="Info (I)"
                            >
                                <Info className="w-6 h-6" />
                            </button>
                            <button
                                onClick={handleDownload}
                                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                                title="Download"
                            >
                                <Download className="w-6 h-6" />
                            </button>
                            {onDelete && (
                                <button
                                    onClick={onDelete}
                                    className="p-2 text-white hover:bg-red-500/80 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Navigation arrows */}
                {canNavigate && currentIndex > 0 && (
                    <button
                        onClick={handlePrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 text-white hover:bg-white/20 rounded-full transition-colors"
                        title="Previous (←)"
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                )}
                {canNavigate && currentIndex < photos.length - 1 && (
                    <button
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 text-white hover:bg-white/20 rounded-full transition-colors"
                        title="Next (→)"
                    >
                        <ChevronRight className="w-8 h-8" />
                    </button>
                )}

                {/* Image container */}
                <div className="absolute inset-0 flex items-center justify-center p-16">
                    <div className="relative">
                        <img
                            ref={imageRef}
                            src={`${photo.url}`}
                            alt={photo.originalName}
                            className="max-w-full max-h-full object-contain"
                        />

                        {/* Face bounding boxes overlay */}
                        {showFaces && faceDetections.length > 0 && (
                            <div className="absolute inset-0 pointer-events-none">
                                {faceDetections.map((face) => {
                                    const { x, y, width, height } = face.boundingBox;
                                    const isSelected = selectedFace === face.id;

                                    return (
                                        <div
                                            key={face.id}
                                            className={`absolute border-2 rounded-lg ${
                                                isSelected ? 'border-blue-500' : 'border-green-500'
                                            } cursor-pointer pointer-events-auto transition-all hover:border-blue-400`}
                                            style={{
                                                left: `${x * imageScale.scaleX}px`,
                                                top: `${y * imageScale.scaleY}px`,
                                                width: `${width * imageScale.scaleX}px`,
                                                height: `${height * imageScale.scaleY}px`,
                                            }}
                                            onClick={() => {
                                                setSelectedFace(face.id);
                                                setManagingFace(face);
                                                loadAllPeople();
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Info panel - slides in from right */}
            {showInfo && (
                <div className="w-[400px] bg-white shadow-2xl overflow-y-auto border-l border-gray-200">
                    <div className="p-6 space-y-6">
                        {/* People section */}
                        {faceDetections.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Users className="w-5 h-5" />
                                        People ({faceDetections.length})
                                    </h3>
                                    <button
                                        onClick={() => setShowFaces(!showFaces)}
                                        className={`text-sm px-3 py-1 rounded-lg ${
                                            showFaces
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {showFaces ? 'Hide' : 'Show'} Faces
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {faceDetections.map((face) => (
                                        <div
                                            key={face.id}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                                selectedFace === face.id
                                                    ? 'bg-blue-50 border border-blue-200'
                                                    : 'hover:bg-blue-50 hover:border hover:border-blue-100'
                                            }`}
                                            onMouseEnter={() => {
                                                if (showFaces) setSelectedFace(face.id);
                                            }}
                                            onMouseLeave={() => {
                                                if (
                                                    showFaces &&
                                                    selectedFace === face.id &&
                                                    !managingFace
                                                ) {
                                                    setSelectedFace(null);
                                                }
                                            }}
                                            onClick={() => {
                                                if (!showFaces) setShowFaces(true);
                                                setSelectedFace(face.id);
                                                setManagingFace(face);
                                                loadAllPeople();
                                            }}
                                        >
                                            {face.personThumbnailUrl ? (
                                                <img
                                                    src={`${face.personThumbnailUrl}`}
                                                    alt={face.personName || 'Unknown'}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                                    <UserCircle className="w-8 h-8 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 truncate">
                                                    {face.personName || 'Unknown'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {face.confidence
                                                        ? `${Math.round(
                                                              face.confidence * 100
                                                          )}% confident`
                                                        : 'Click to manage'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-6">Details</h3>

                            <div className="space-y-4">
                                {photo.takenAt && (
                                    <DetailRowWithIcon
                                        icon={<Calendar className="w-5 h-5 text-gray-600" />}
                                        label={formatDate(photo.takenAt).split(',')[0]}
                                        value={formatDate(photo.takenAt)
                                            .split(',')
                                            .slice(1)
                                            .join(',')
                                            .trim()}
                                    />
                                )}
                                <DetailRowWithIcon
                                    icon={<ImageIcon className="w-5 h-5 text-gray-600" />}
                                    label={photo.originalName}
                                    value={`${photo.width} × ${photo.height}${
                                        photo.width && photo.height
                                            ? ` • ${formatFileSize(photo.size)}`
                                            : ''
                                    }`}
                                />
                                <DetailRowWithIcon
                                    icon={<Upload className="w-5 h-5 text-gray-600" />}
                                    label="Uploaded from web"
                                    value={formatDate(photo.uploadedAt)}
                                />
                            </div>
                        </div>

                        {metadata && (
                            <>
                                {metadata.gpsLatitude !== null &&
                                    metadata.gpsLatitude !== undefined &&
                                    metadata.gpsLongitude !== null &&
                                    metadata.gpsLongitude !== undefined && (
                                        <div>
                                            <DetailRowWithIcon
                                                icon={<MapPin className="w-5 h-5 text-gray-600" />}
                                                label={
                                                    metadata.locationName ||
                                                    `${metadata.gpsLatitude.toFixed(
                                                        6
                                                    )}, ${metadata.gpsLongitude.toFixed(6)}`
                                                }
                                                value=""
                                                link={`https://www.google.com/maps?q=${metadata.gpsLatitude},${metadata.gpsLongitude}`}
                                            />
                                        </div>
                                    )}

                                {(metadata.cameraMake || metadata.cameraModel) && (
                                    <div>
                                        <DetailRowWithIcon
                                            icon={<Camera className="w-5 h-5 text-gray-600" />}
                                            label={[metadata.cameraMake, metadata.cameraModel]
                                                .filter(Boolean)
                                                .join(' ')}
                                            value={metadata.lens || ''}
                                        />
                                    </div>
                                )}

                                {(metadata.aperture ||
                                    metadata.shutterSpeed ||
                                    metadata.iso ||
                                    metadata.focalLength ||
                                    metadata.flash) && (
                                    <div>
                                        <DetailRowWithIcon
                                            icon={<Settings className="w-5 h-5 text-gray-600" />}
                                            label="Camera settings"
                                            value={[
                                                metadata.focalLength,
                                                metadata.aperture,
                                                metadata.shutterSpeed,
                                                metadata.iso ? `ISO ${metadata.iso}` : null,
                                                metadata.flash,
                                            ]
                                                .filter(Boolean)
                                                .join(' • ')}
                                        />
                                    </div>
                                )}

                                {metadata.orientation && (
                                    <div>
                                        <DetailRowWithIcon
                                            icon={<FileText className="w-5 h-5 text-gray-600" />}
                                            label="Other"
                                            value={
                                                typeof metadata.orientation === 'string'
                                                    ? metadata.orientation
                                                    : `Orientation: ${metadata.orientation}`
                                            }
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {showInfo && !metadata && !loadingMetadata && (
                            <p className="text-sm text-gray-500">
                                No additional metadata available
                            </p>
                        )}

                        {loadingMetadata && (
                            <p className="text-sm text-gray-500">Loading metadata...</p>
                        )}
                    </div>
                </div>
            )}

            {/* Face Management Modal */}
            {managingFace && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Manage Face</h2>
                            <button
                                onClick={() => {
                                    setManagingFace(null);
                                    setSelectedFace(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Face preview - cropped to bounding box */}
                        <div className="mb-4">
                            <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                <div
                                    className="absolute inset-0 bg-center bg-no-repeat"
                                    style={{
                                        backgroundImage: `url(${photo.url})`,
                                        backgroundSize: `${
                                            ((photo.width || 0) / managingFace.boundingBox.width) *
                                            100
                                        }%`,
                                        backgroundPositionX: `${
                                            (managingFace.boundingBox.x /
                                                (managingFace.boundingBox.width -
                                                    (photo.width || 0))) *
                                            -100
                                        }%`,
                                        backgroundPositionY: `${
                                            (managingFace.boundingBox.y /
                                                (managingFace.boundingBox.height -
                                                    (photo.height || 0))) *
                                            -100
                                        }%`,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Current person */}
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {managingFace.personThumbnailUrl ? (
                                    <img
                                        src={`${managingFace.personThumbnailUrl}`}
                                        alt={managingFace.personName || 'Unknown'}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                        <UserCircle className="w-8 h-8 text-gray-400" />
                                    </div>
                                )}
                                <div>
                                    <div className="text-sm text-gray-500">Currently tagged as</div>
                                    <div className="font-semibold text-gray-900">
                                        {managingFace.personName || 'Unknown'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Reassign to existing person */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">
                                    Reassign to another person
                                </h3>
                                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                                    {allPeople
                                        .filter((p) => p.id !== managingFace.personId)
                                        .map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() =>
                                                    handleReassignFace(managingFace.id, p.id)
                                                }
                                                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                            >
                                                {p.thumbnailUrl ? (
                                                    <img
                                                        src={`${p.thumbnailUrl}`}
                                                        alt={p.name || 'Unknown'}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                        <UserCircle className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 text-left">
                                                    <div className="font-medium">
                                                        {p.name || 'Unknown'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {p.photoCount} photos
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            </div>

                            {/* Create new person */}
                            <button
                                onClick={() => handleReassignFace(managingFace.id)}
                                className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                            >
                                <UserPlus className="w-5 h-5" />
                                <span className="font-medium">Create New Person</span>
                            </button>

                            {/* Remove face detection */}
                            <button
                                onClick={() => handleRemoveFace(managingFace.id)}
                                className="w-full flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                            >
                                <Trash className="w-5 h-5" />
                                <span className="font-medium">Remove Face Detection</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRowWithIcon({
    icon,
    label,
    value,
    link,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    link?: string;
}) {
    return (
        <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
                {link ? (
                    <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-900 hover:underline block"
                    >
                        {label}
                    </a>
                ) : (
                    <div className="text-sm text-gray-900">{label}</div>
                )}
                {value && <div className="text-sm text-gray-600 mt-0.5">{value}</div>}
            </div>
        </div>
    );
}
