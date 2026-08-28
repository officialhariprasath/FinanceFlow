import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** APKs in public/releases must not ship inside the Android app bundle. */
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

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), stripReleaseApksFromDist()],
});