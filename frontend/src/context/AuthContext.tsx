import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { getSession } from "../services/agentService";
import type { SessionInfo } from "../types/agent";

interface AuthContextValue {
  token: string | null;
  session: SessionInfo | null;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("access_token")
  );
  const [session, setSession] = useState<SessionInfo | null>(null);

  async function loadSession() {
    try {
      const data = await getSession();
      setSession(data);
    } catch {
      setSession(null);
      localStorage.removeItem("access_token");
      setToken(null);
    }
  }

  async function login(newToken: string) {
    localStorage.setItem("access_token", newToken);
    setToken(newToken);
    await loadSession();
  }

  function logout() {
    localStorage.removeItem("access_token");
    setToken(null);
    setSession(null);
  }

  function hasPermission(key: string): boolean {
    if (!session) return false;
    if (session.is_owner) return true;
    return session.permissions.includes(key);
  }

  useEffect(() => {
    if (token) {
      loadSession();
    } else {
      setSession(null);
    }
  }, [token]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "access_token") {
        setToken(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        session,
        isAuthenticated: !!token && !!session,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
