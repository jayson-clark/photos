import { Outlet } from 'react-router-dom';
import { Search, UserCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';

export default function Layout() {
    const { user, logout } = useAuth();

    return (
        <div className="flex h-screen bg-white">
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6">
                    <div className="flex-1 max-w-2xl">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search your photos"
                                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <UserCircle2 className="w-8 h-8 text-gray-600" />
                            <div className="hidden md:block">
                                <div className="text-sm font-medium text-gray-900">
                                    {user?.username}
                                </div>
                                <div className="text-xs text-gray-500">{user?.email}</div>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                </div>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto bg-gray-50">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
