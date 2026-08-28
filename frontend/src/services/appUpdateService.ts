import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

import ApkInstaller from "../plugins/apkInstaller";
import { API_BASE_URL } from "../config/api";

export type AppUpdateInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
  force?: boolean;
};

export type LocalAppInfo = {
  versionCode: number;
  versionName: string;
};

const APK_CACHE_PATH = "FinanceFlow-update.apk";
const SNOOZE_KEY = "app_update_snooze";
const LAST_AUTO_CHECK_KEY = "app_update_last_auto_check";
/** Minimum time between background update checks (6 hours). */
export const AUTO_UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
/** How long "Later" hides the same version prompt. */
export const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;

export type UpdateSnooze = {
  versionCode: number;
  until: number;
};

/** Where the phone looks for the latest version metadata. */
export function getUpdateManifestUrls(): string[] {
  const fromEnv = import.meta.env.VITE_APP_UPDATE_URL?.trim();
  const urls: string[] = [];
  if (fromEnv) urls.push(fromEnv);
  urls.push(`${API_BASE_URL.replace(/\/$/, "")}/app/update`);
  urls.push("https://finance-flow-rho-ten.vercel.app/app-update.json");
  return [...new Set(urls)];
}

export async function getLocalAppInfo(): Promise<LocalAppInfo> {
  if (!Capacitor.isNativePlatform()) {
    return { versionCode: 0, versionName: "web" };
  }
  const info = await App.getInfo();
  // Capacitor returns build as versionCode string on Android
  const versionCode = Number.parseInt(info.build || "0", 10) || 0;
  return { versionCode, versionName: info.version || "0" };
}

export async function fetchRemoteUpdateInfo(): Promise<AppUpdateInfo | null> {
  for (const url of getUpdateManifestUrls()) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as AppUpdateInfo;
      if (
        typeof data.versionCode === "number" &&
        typeof data.apkUrl === "string" &&
        data.apkUrl.length > 0
      ) {
        return data;
      }
    } catch {
      // try next URL
    }
  }
  return null;
}

export async function checkForAppUpdate(): Promise<{
  update: AppUpdateInfo | null;
  local: LocalAppInfo;
}> {
  const local = await getLocalAppInfo();
  if (!Capacitor.isNativePlatform()) {
    return { update: null, local };
  }
  const remote = await fetchRemoteUpdateInfo();
  if (!remote || remote.versionCode <= local.versionCode) {
    return { update: null, local };
  }
  return { update: remote, local };
}

async function prefsGet(key: string): Promise<string | null> {
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key });
  return value;
}

async function prefsSet(key: string, value: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key, value });
}

export async function getUpdateSnooze(): Promise<UpdateSnooze | null> {
  const raw = await prefsGet(SNOOZE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UpdateSnooze;
    if (typeof parsed.versionCode === "number" && typeof parsed.until === "number") {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function snoozeAppUpdate(versionCode: number, ms = UPDATE_SNOOZE_MS): Promise<void> {
  const payload: UpdateSnooze = { versionCode, until: Date.now() + ms };
  await prefsSet(SNOOZE_KEY, JSON.stringify(payload));
}

export async function clearUpdateSnooze(): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key: SNOOZE_KEY });
}

export async function isUpdateSnoozed(versionCode: number): Promise<boolean> {
  const snooze = await getUpdateSnooze();
  if (!snooze || snooze.versionCode !== versionCode) return false;
  if (Date.now() >= snooze.until) {
    await clearUpdateSnooze();
    return false;
  }
  return true;
}

export async function shouldRunAutoUpdateCheck(): Promise<boolean> {
  const raw = await prefsGet(LAST_AUTO_CHECK_KEY);
  const last = raw ? Number.parseInt(raw, 10) : 0;
  if (!last || Number.isNaN(last)) return true;
  return Date.now() - last >= AUTO_UPDATE_CHECK_MS;
}

export async function markAutoUpdateCheck(): Promise<void> {
  await prefsSet(LAST_AUTO_CHECK_KEY, String(Date.now()));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function downloadAndInstallUpdate(
  update: AppUpdateInfo,
  onProgress?: (pct: number) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Updates only apply inside the Android app.");
  }

  const candidates = [update.apkUrl].filter(Boolean);

  onProgress?.(5);
  let res: Response | null = null;
  let lastStatus = 0;
  for (const url of candidates) {
    try {
      const attempt = await fetch(url, { cache: "no-store", redirect: "follow" });
      lastStatus = attempt.status;
      if (attempt.ok) {
        res = attempt;
        break;
      }
    } catch {
      // try next
    }
  }
  if (!res) {
    throw new Error(
      `Download failed (${lastStatus || "network"}). Update file is missing — try again after the latest deploy, or install FinanceFlow-v1.2.6.apk manually.`
    );
  }

  const reader = res.body?.getReader();
  const total = Number(res.headers.get("content-length") || 0);
  const chunks: Uint8Array[] = [];
  let received = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (total > 0) {
          onProgress?.(Math.min(90, Math.round((received / total) * 85) + 5));
        }
      }
    }
  } else {
    const buf = new Uint8Array(await res.arrayBuffer());
    chunks.push(buf);
    received = buf.length;
  }

  if (received < 100_000) {
    throw new Error("Downloaded file looks too small to be an APK. Check the update link.");
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const part of chunks) {
    merged.set(part, offset);
    offset += part.length;
  }

  onProgress?.(92);
  const base64 = arrayBufferToBase64(merged.buffer);
  await Filesystem.writeFile({
    path: APK_CACHE_PATH,
    data: base64,
    directory: Directory.Cache,
  });

  const { uri } = await Filesystem.getUri({
    path: APK_CACHE_PATH,
    directory: Directory.Cache,
  });

  onProgress?.(98);
  try {
    const permission = await ApkInstaller.canRequestPackageInstalls();
    if (!permission.allowed) {
      await ApkInstaller.openInstallSettings();
      throw new Error(
        "Turn on “Allow from this source” for FinanceFlow, then tap Update again."
      );
    }
    await ApkInstaller.install({ path: uri });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Allow from this source") || msg.includes("Allow install")) {
      throw e instanceof Error ? e : new Error(msg);
    }
    throw new Error(msg || "Could not open the Android installer.");
  }
  onProgress?.(100);
}
