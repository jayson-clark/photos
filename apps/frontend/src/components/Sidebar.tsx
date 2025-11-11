import { Link, useLocation } from 'react-router-dom';
import {
    Image,
    Album as AlbumIcon,
    Users,
    MapPin,
    Clock,
    Star,
    Trash2,
    Settings,
    Shield,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
    const location = useLocation();
    const { user } = useAuth();

    const isActive = (path: string) => location.pathname === path;

    const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
        <Link
            to={to}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                isActive(to)
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
            }`}
        >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </Link>
    );

    return (
        <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Image className="w-6 h-6 text-blue-600" />
                    Photos
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <div className="mb-6">
                    <NavItem to="/photos" icon={Image} label="Photos" />
                    <NavItem to="/albums" icon={AlbumIcon} label="Albums" />
                </div>

                <div className="mb-6">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Explore
                    </div>
                    <NavItem to="/people" icon={Users} label="People" />
                    <NavItem to="/places" icon={MapPin} label="Places" />
                    <NavItem to="/recent" icon={Clock} label="Recently added" />
                    <NavItem to="/favorites" icon={Star} label="Favorites" />
                </div>

                <div className="mb-6">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Library
                    </div>
                    <NavItem to="/trash" icon={Trash2} label="Trash" />
                </div>

                {user?.isAdmin && (
                    <div>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Admin
                        </div>
                        <NavItem to="/admin" icon={Shield} label="Manage Users" />
                    </div>
                )}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
                <button className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors w-full">
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                </button>
            </div>
        </div>
    );
}
