import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';

export default function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center text-(--text-tertiary) text-sm">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}
