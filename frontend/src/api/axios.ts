import axios from "axios";
import { API_BASE_URL } from "../config/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90_000, // Render free tier can be slow to wake
  headers: { "Content-Type": "application/json" },
});

const PUBLIC_AUTH_PATHS = [
  "/finance-owners/login",
  "/finance-owners/register",
  "/agents/login",
  "/auth/send-otp",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function isPublicAuthRequest(url?: string): boolean {
  if (!url) return false;
  return PUBLIC_AUTH_PATHS.some((p) => url.includes(p));
}

api.interceptors.request.use((config) => {
  // Never attach a stale token to login/register/OTP — it confuses 401 handling.
  if (!isPublicAuthRequest(config.url)) {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url as string | undefined;
    // Login/register failures are 401/400 — do NOT treat as "session expired".
    if (status === 401 && !isPublicAuthRequest(url)) {
      localStorage.removeItem("access_token");
      if (window.location.pathname !== "/" && window.location.pathname !== "/forgot-password") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
