import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/authService";
import { agentLogin } from "../../services/agentService";
import { useAuth } from "../../context/AuthContext";

type LoginMode = "owner" | "agent";

interface Props {
  agentOnly?: boolean;
}

function LoginForm({ agentOnly = false }: Props) {
  const { login: setToken } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>(agentOnly ? "agent" : "owner");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      const data =
        mode === "owner"
          ? await login(identifier, password)
          : await agentLogin(identifier, password);
      await setToken(data.access_token);
      const isAgent = agentOnly || mode === "agent";
      navigate(isAgent ? "/collections" : "/dashboard");
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { detail?: string } };
        message?: string;
        code?: string;
      };
      const detail = ax.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (!ax.response && (ax.message === "Network Error" || ax.code === "ERR_NETWORK")) {
        const api = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
          ?.VITE_API_BASE_URL;
        setError(
          api
            ? `Cannot reach API at ${api}. Is the local server running?`
            : "Cannot reach server. Check internet or try again in a minute."
        );
      } else {
        setError("Login failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!agentOnly && (
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
          <button
            type="button"
            onClick={() => setMode("owner")}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === "owner"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            Owner
          </button>
          <button
            type="button"
            onClick={() => setMode("agent")}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === "agent"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-200"
            }`}
          >
            Agent
          </button>
        </div>
      )}

      <div>
        <label className="label-field">Email or mobile number</label>
        <input
          type="text"
          inputMode="email"
          autoComplete="username"
          placeholder="email@example.com or 9876543210"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className="input-field px-4 py-3"
        />
      </div>

      <div>
        <div className="mb-2 flex justify-between">
          <label className="label-field">Password</label>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-sm text-blue-600 dark:text-blue-400"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input-field px-4 py-3"
        />
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Forgot password?
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Logging in..." : agentOnly || mode === "agent" ? "Agent Login" : "Owner Login"}
      </button>
    </form>
  );
}

export default LoginForm;
