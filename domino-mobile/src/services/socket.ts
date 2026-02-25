import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ServerToClientEvents, ClientToServerEvents } from "../types/gameTypes";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ---- Change this to your server IP / URL ----
// When running on a real device, use your machine's LAN IP  (e.g. 192.168.x.x)
// When running on an Android emulator, use 10.0.2.2 for localhost
// When running on an iOS simulator, use localhost
const SERVER_URL = "http://10.61.11.163:3000"; // <-- UPDATE THIS

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
