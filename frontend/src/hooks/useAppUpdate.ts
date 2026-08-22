import { useCallback, useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  type AppUpdateInfo,
  type LocalAppInfo,
} from "../services/appUpdateService";

export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [local, setLocal] = useState<LocalAppInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const runCheck = useCallback(async (manual = false) => {
    if (!Capacitor.isNativePlatform()) {
      return { update: null as AppUpdateInfo | null, local: null as LocalAppInfo | null };
    }
    try {
      setChecking(true);
      setError("");
      const result = await checkForAppUpdate();
      setLocal(result.local);
      setUpdate(result.update);
      if (manual && !result.update) {
        setError("You are on the latest version.");
      }
      if (result.update) setDismissed(false);
      return result;
    } catch {
      if (manual) setError("Could not check for updates.");
      return { update: null, local: null };
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const t = window.setTimeout(() => {
      void runCheck(false);
    }, 2500);

    let remove: (() => void) | undefined;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void runCheck(false);
    }).then((h) => {
      remove = () => {
        void h.remove();
      };
    });

    return () => {
      window.clearTimeout(t);
      remove?.();
    };
  }, [runCheck]);

  async function installUpdate() {
    if (!update) return;
    try {
      setInstalling(true);
      setProgress(0);
      setError("");
      await downloadAndInstallUpdate(update, setProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setInstalling(false);
    }
  }

  return {
    update: dismissed ? null : update,
    pendingUpdate: update,
    local,
    checking,
    installing,
    progress,
    error,
    setError,
    dismiss: () => setDismissed(true),
    checkNow: () => runCheck(true),
    installUpdate,
  };
}
