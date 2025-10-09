export default ({ config }) => ({
  ...config,
  name: "VULU",
  slug: "vulu",
  version: "0.0.3",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#131318"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.vulu.app",
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription: "VuluGO needs access to your camera to enable live streaming.",
      NSMicrophoneUsageDescription: "VuluGO needs access to your microphone to enable live streaming audio."
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#131318"
    },
    package: "com.vulu.app",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT"
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: [],
  scheme: "vulu",
  experiments: {
    tsconfigPaths: true
  },
  extra: {
    router: {},
    eas: {
      projectId: "1605b9e3-65c9-49fc-bbc5-1cfece90dffd"
    }
  }
});
