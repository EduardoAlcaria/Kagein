import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { credential } = useAuth();
  if (!credential) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
