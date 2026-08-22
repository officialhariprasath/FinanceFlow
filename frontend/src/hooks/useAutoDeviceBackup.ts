import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

import { useAuth } from "../context/AuthContext";
import {
  createDeviceBackup,
  getBackupMeta,
} from "../services/localBackupService";

const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // at most every 6 hours

/**
 * When signed in on the Android app, keep an automatic local backup
 * so the phone retains a recoverable copy of business data.
 */
export function useAutoDeviceBackup() {
  const { isAuthenticated, session } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function maybeBackup(reason: string) {
      if (running.current) return;
      running.current = true;
      try {
        const meta = await getBackupMeta();
        if (meta) {
          const age = Date.now() - new Date(meta.exported_at).getTime();
          if (age < MIN_INTERVAL_MS && reason !== "manual-login") return;
        }
        await createDeviceBackup(session?.display_name ?? undefined);
      } catch {
        // Silent — network may be offline; user can retry from Settings.
      } finally {
        running.current = false;
      }
    }

    // Shortly after login / app open
    const t = window.setTimeout(() => {
      void maybeBackup(session ? "manual-login" : "open");
    }, 4000);

    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void maybeBackup("resume");
      }).then((h) => {
        remove = () => {
          void h.remove();
        };
      });
    }

    return () => {
      window.clearTimeout(t);
      remove?.();
    };
  }, [isAuthenticated, session?.display_name]);
}
