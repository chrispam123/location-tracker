import 'dotenv/config';

export default {
  expo: {
    name: "Location Tracker",
    slug: "location-tracker",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs location access to track your position.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs background location access for continuous tracking."
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#FFFFFF"
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        "WAKE_LOCK",
        "RECEIVE_BOOT_COMPLETED",
        "FOREGROUND_SERVICE"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      },
      intentFilters: [
        {
          action: "android.intent.action.BOOT_COMPLETED",
          category: ["android.intent.category.DEFAULT"]
        }
      ]
    }
  }
};