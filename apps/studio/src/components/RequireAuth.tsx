import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

interface RequireAuthProps {
  children?: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { user, isInitialized, isLoading, initialize } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, []);

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children ?? <Outlet />}</>;
};
