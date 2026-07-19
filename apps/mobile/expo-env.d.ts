/// <reference types="expo/types/global" />

// Declare process for Expo public env vars (metro bundler inlines EXPO_PUBLIC_*)
declare const process: {
  env: Record<string, string | undefined>;
};
