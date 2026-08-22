/**
 * API base URL for web and mobile builds.
 * Mobile APK uses `.env.mobile` (full app). Optional agent-only APK uses `.env.agent`.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8000";

export const IS_AGENT_APP = import.meta.env.VITE_AGENT_APP === "true";
