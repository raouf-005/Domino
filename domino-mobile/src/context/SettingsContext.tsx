/**
 * SettingsContext — Persistent user preferences for animations, quality, etc.
 *
 * All settings are saved to AsyncStorage and restored on app launch.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Types ──
export type RenderQuality = "low" | "medium" | "high";
export type AnimationIntensity = "off" | "minimal" | "full";

export interface Settings {
  // Animations
  winSlamAnimation: boolean; // Hand slams board on win
  confettiAnimation: boolean; // Confetti burst on win
  screenShake: boolean; // Screen shake on big plays
  dominoTrails: boolean; // Particle trail when dragging tiles
  victoryFireworks: boolean; // Fireworks on win
  funnyEmojis: boolean; // Emoji rain / reactions
  hapticFeedback: boolean; // Vibration feedback
  animationIntensity: AnimationIntensity;

  // Quality / Performance
  renderQuality: RenderQuality;
  reducedMotion: boolean; // Skip all animations

  // Sound (placeholders for future)
  soundEnabled: boolean;
  soundVolume: number; // 0-1
}

const DEFAULT_SETTINGS: Settings = {
  winSlamAnimation: true,
  confettiAnimation: true,
  screenShake: true,
  dominoTrails: true,
  victoryFireworks: true,
  funnyEmojis: true,
  hapticFeedback: true,
  animationIntensity: "full",

  renderQuality: "medium",
  reducedMotion: false,

  soundEnabled: true,
  soundVolume: 0.7,
};

const STORAGE_KEY = "@domino_settings";

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  loaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings>;
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // ignore
      }
      setLoaded(true);
    })();
  }, []);

  // Persist on change
  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)).catch(
      () => {},
    );
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, updateSetting, resetSettings, loaded }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
