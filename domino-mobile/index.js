// Custom entry to ensure Expo Router has its required env vars set.
// Some dependency mixes can cause EXPO_ROUTER_APP_ROOT to be unset at runtime.

if (typeof process !== "undefined") {
  process.env = process.env ?? {};
  process.env.EXPO_ROUTER_APP_ROOT =
    process.env.EXPO_ROUTER_APP_ROOT ?? "./app";
}

import "expo-router/entry";
