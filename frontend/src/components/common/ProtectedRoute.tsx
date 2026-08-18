import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, session, isAuthenticated } = useAuth();

  if (!token) return <Navigate to="/" replace />;
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Loading session...
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}
