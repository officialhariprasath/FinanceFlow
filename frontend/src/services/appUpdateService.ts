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

  const candidates = [
    update.apkUrl,
    "https://finance-flow-rho-ten.vercel.app/releases/FinanceFlow-v1.2.1.apk",
    "https://github.com/officialhariprasath/FinanceFlow/releases/download/1.2.1/FinanceFlow-v1.2.1.apk",
  ].filter((u, i, arr) => u && arr.indexOf(u) === i);

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
      `Download failed (${lastStatus || "network"}). Update file is missing — try again after the latest deploy, or install FinanceFlow-v1.2.1.apk manually.`
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
