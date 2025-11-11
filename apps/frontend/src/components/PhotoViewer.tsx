import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Photo, PhotoMetadata } from '@photos/shared';
import { photosAPI } from '../lib/api';

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

    // Reset metadata when photo changes
    useEffect(() => {
        setMetadata(null);
        setLoadingMetadata(false);
        if (showInfo) {
            loadMetadata();
        }
    }, [photo.id]);

    useEffect(() => {
        if (showInfo && !metadata && !loadingMetadata) {
            loadMetadata();
        }
    }, [showInfo]);

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
        link.href = `http://localhost:3001${photo.url}`;
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
                    <img
                        src={`http://localhost:3001${photo.url}`}
                        alt={photo.originalName}
                        className="max-w-full max-h-full object-contain"
                    />
                </div>
            </div>

            {/* Info panel - slides in from right */}
            {showInfo && (
                <div className="w-[400px] bg-white shadow-2xl overflow-y-auto border-l border-gray-200">
                    <div className="p-6 space-y-6">
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
