import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
    const { me, loading } = useAuth();

    if (loading) {
        return <main className="app-shell loading"><p>Checking session...</p></main>;
    }

    if (!me) {
        return <Navigate to="/auth" replace />;
    }

    return <Outlet />;
}
