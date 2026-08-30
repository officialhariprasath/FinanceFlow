import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** APKs in public/releases must not ship inside the Android/Capacitor app bundle. */
function stripReleaseApksFromDist() {
  return {
    name: "strip-release-apks",
    closeBundle() {
      const releasesDir = path.join("dist", "releases");
      if (!fs.existsSync(releasesDir)) return;
      for (const name of fs.readdirSync(releasesDir)) {
        if (name.endsWith(".apk")) {
          fs.unlinkSync(path.join(releasesDir, name));
        }
      }
    },
  };
}

// Only strip APKs for Capacitor agent/mobile builds.
// Production (Vercel) must keep them so in-app update can download the APK.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "agent" || mode === "mobile" ? [stripReleaseApksFromDist()] : []),
  ],
}));
