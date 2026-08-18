/**
 * API base URL for web and mobile builds.
 * Set VITE_API_BASE_URL before building the agent APK
 * (e.g. http://192.168.1.5:8000 for agents on the same Wi‑Fi).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8000";

export const IS_AGENT_APP = import.meta.env.VITE_AGENT_APP === "true";
