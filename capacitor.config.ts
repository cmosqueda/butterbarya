import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.butterbarya.payroll",
  appName: "Butterbarya",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: true,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: "Unlock Butterbarya",
        biometricSubTitle: "Authenticate to access your payroll data",
      },
      iosDatabaseLocation: "Library/CapacitorDatabase",
      iosIsEncryption: true,
      iosKeychainPrefix: "app.butterbarya.payroll",
      iosBiometric: {
        biometricAuth: false,
        biometricTitle: "Unlock Butterbarya",
      },
    },
  },
};

export default config;
