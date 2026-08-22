import { registerPlugin } from "@capacitor/core";

export type ApkInstallerPlugin = {
  canRequestPackageInstalls(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  install(options: { path: string }): Promise<void>;
};

const ApkInstaller = registerPlugin<ApkInstallerPlugin>("ApkInstaller");

export default ApkInstaller;
