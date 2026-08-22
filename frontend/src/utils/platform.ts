import { Capacitor } from "@capacitor/core";

/** True when running inside the native Android/iOS shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function platformLabel(): string {
  if (!Capacitor.isNativePlatform()) return "Web";
  const p = Capacitor.getPlatform();
  if (p === "android") return "Android app";
  if (p === "ios") return "iOS app";
  return p;
}
