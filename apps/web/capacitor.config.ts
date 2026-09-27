import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bluejury.app",
  appName: "BLUEJURY AI",
  webDir: "out",
  loggingBehavior: "debug",
  server: {
    hostname: "localhost",
    androidScheme: "https",
  },
};

export default config;
