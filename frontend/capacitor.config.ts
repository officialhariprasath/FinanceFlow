import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.financeflow.agent",
  appName: "FinanceFlow",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#1d4ed8",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1d4ed8",
    },
  },
};

export default config;
