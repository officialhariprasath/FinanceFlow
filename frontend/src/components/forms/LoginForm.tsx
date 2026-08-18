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
  const [email, setEmail] = useState("");
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
          ? await login(email, password)
          : await agentLogin(email, password);
      await setToken(data.access_token);
      const isAgent = agentOnly || mode === "agent";
      navigate(isAgent ? "/collections" : "/dashboard");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Login failed.");
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
        <label className="label-field">Email Address</label>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
