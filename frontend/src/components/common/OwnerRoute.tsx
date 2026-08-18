import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { ReactNode } from "react";

/** Restrict route to finance owner (not agents). */
export default function OwnerRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  if (!session?.is_owner) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
