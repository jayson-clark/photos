import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Photos from './pages/Photos';
import Albums from './pages/Albums';
import AlbumDetail from './pages/AlbumDetail';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';
import Places from './pages/Places';
import Admin from './pages/Admin';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    return user ? <>{children}</> : <Navigate to="/login" />;
}

// Allow access to album detail if there's a share token in the URL
function AlbumRoute() {
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const hasShareToken = searchParams.has('token');

    // If there's a share token, allow access without auth
    if (hasShareToken) {
        return <AlbumDetail />;
    }

    // Otherwise require authentication
    return user ? <AlbumDetail /> : <Navigate to="/login" />;
}

function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Allow album access with share token without requiring auth */}
                <Route path="/albums/:id" element={<AlbumRoute />} />

                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Layout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<Navigate to="/photos" replace />} />
                    <Route path="photos" element={<Photos />} />
                    <Route path="albums" element={<Albums />} />
                    <Route path="people" element={<People />} />
                    <Route path="people/:id" element={<PersonDetail />} />
                    <Route path="places" element={<Places />} />
                    <Route path="recent" element={<Photos />} />
                    <Route path="favorites" element={<Photos />} />
                    <Route path="trash" element={<Photos />} />
                    <Route path="admin" element={<Admin />} />
                </Route>
            </Routes>
        </AuthProvider>
    );
}

export default App;
