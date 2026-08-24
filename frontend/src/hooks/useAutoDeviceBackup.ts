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
 * Silent on-device backup for the Android app only.
 * Never triggers a file download. Web / login must not auto-export.
 */
export function useAutoDeviceBackup() {
  const { isAuthenticated, session } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    // Auto backup is native-only and never downloads a file.
    if (!isAuthenticated || !Capacitor.isNativePlatform()) return;

    async function maybeBackup() {
      if (running.current) return;
      running.current = true;
      try {
        const meta = await getBackupMeta();
        if (meta) {
          const age = Date.now() - new Date(meta.exported_at).getTime();
          if (age < MIN_INTERVAL_MS) return;
        }
        // Silent write to app storage — no Share / no browser download.
        await createDeviceBackup(session?.display_name ?? undefined, {
          download: false,
        });
      } catch {
        // Offline / permission — user can retry from Settings.
      } finally {
        running.current = false;
      }
    }

    const t = window.setTimeout(() => {
      void maybeBackup();
    }, 8000);

    let remove: (() => void) | undefined;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void maybeBackup();
    }).then((h) => {
      remove = () => {
        void h.remove();
      };
    });

    return () => {
      window.clearTimeout(t);
      remove?.();
    };
  }, [isAuthenticated, session?.display_name]);
}
