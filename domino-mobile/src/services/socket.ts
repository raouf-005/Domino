import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  DeviceMetadata,
} from "../types/gameTypes";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ---- Change this to your server IP / URL ----
// When running on a real device, use your machine's LAN IP  (e.g. 192.168.x.x)
// When running on an Android emulator, use 10.0.2.2 for localhost
// When running on an iOS simulator, use localhost
const SERVER_URL = "https://domino-eqtk.onrender.com"; // <-- UPDATE THIS

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }) as GameSocket;
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Persistent device ID
const STORAGE_KEY = "domino_device_id";

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(STORAGE_KEY);
  if (id) return id;

  // Generate a unique device ID
  id =
    "mob-" +
    Math.random().toString(36).substring(2, 10) +
    "-" +
    Date.now().toString(36);
  await AsyncStorage.setItem(STORAGE_KEY, id);
  return id;
}

export async function getDeviceMetadata(): Promise<DeviceMetadata> {
  const installId = await getDeviceId();
  const modelName =
    Constants.platform?.ios?.model ||
    Constants.platform?.android?.model ||
    Constants.deviceName ||
    "unknown-mobile";

  return {
    machineFingerprint: installId,
    platform: Platform.OS,
    os: String(Platform.Version ?? "unknown"),
    model: modelName,
    userAgent: `expo-${Platform.OS}`,
    language:
      Array.isArray(Constants.systemLanguages) &&
      Constants.systemLanguages.length > 0
        ? Constants.systemLanguages[0]
        : undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    networkStatus: "online",
  };
}
