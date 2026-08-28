import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import {
  checkForAppUpdate,
  clearUpdateSnooze,
  downloadAndInstallUpdate,
  isUpdateSnoozed,
  markAutoUpdateCheck,
  shouldRunAutoUpdateCheck,
  snoozeAppUpdate,
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
  const initialCheckDone = useRef(false);

  const applyUpdateResult = useCallback(
    async (result: { update: AppUpdateInfo | null; local: LocalAppInfo }, manual: boolean) => {
      setLocal(result.local);
      if (!result.update) {
        setUpdate(null);
        await clearUpdateSnooze();
        return result;
      }
      const snoozed = !manual && (await isUpdateSnoozed(result.update.versionCode));
      setUpdate(snoozed ? null : result.update);
      return result;
    },
    []
  );

  const runCheck = useCallback(
    async (manual = false) => {
      if (!Capacitor.isNativePlatform()) {
        return { update: null as AppUpdateInfo | null, local: null as LocalAppInfo | null };
      }
      try {
        setChecking(true);
        if (manual) setError("");
        const result = await checkForAppUpdate();
        const applied = await applyUpdateResult(result, manual);
        if (manual && !applied.update) {
          setError("You are on the latest version.");
        }
        return applied;
      } catch {
        if (manual) setError("Could not check for updates.");
        return { update: null, local: null };
      } finally {
        setChecking(false);
      }
    },
    [applyUpdateResult]
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const bootCheck = window.setTimeout(() => {
      initialCheckDone.current = true;
      void (async () => {
        await markAutoUpdateCheck();
        await runCheck(false);
      })();
    }, 2500);

    let remove: (() => void) | undefined;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive || !initialCheckDone.current) return;
      void (async () => {
        if (!(await shouldRunAutoUpdateCheck())) return;
        await markAutoUpdateCheck();
        await runCheck(false);
      })();
    }).then((h) => {
      remove = () => {
        void h.remove();
      };
    });

    return () => {
      window.clearTimeout(bootCheck);
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
      // Installer opened — avoid immediate re-prompt if user returns without finishing.
      await snoozeAppUpdate(update.versionCode, 60 * 60 * 1000);
      setUpdate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setInstalling(false);
    }
  }

  async function dismissUpdate() {
    if (update) {
      await snoozeAppUpdate(update.versionCode);
    }
    setUpdate(null);
  }

  return {
    update,
    pendingUpdate: update,
    local,
    checking,
    installing,
    progress,
    error,
    setError,
    dismiss: () => {
      void dismissUpdate();
    },
    checkNow: () => runCheck(true),
    installUpdate,
  };
}
