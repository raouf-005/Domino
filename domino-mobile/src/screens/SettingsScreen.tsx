/**
 * SettingsScreen — full settings panel with animation toggles,
 * quality controls, and other preferences.
 *
 * Accessible from LobbyScreen and GameScreen via a gear icon.
 */
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown, SlideInRight } from "react-native-reanimated";
import {
  type AnimationIntensity,
  type RenderQuality,
  useSettings,
} from "../context/SettingsContext";
import { Colors } from "../theme/colors";

const STATUS_BAR_H =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44;

// ── Helpers ──
function SectionHeader({
  icon,
  title,
  delay,
}: {
  icon: string;
  title: string;
  delay: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(delay)}
      style={styles.sectionHeader}
    >
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </Animated.View>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
  delay,
  disabled,
}: {
  icon: string;
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  delay: number;
  disabled?: boolean;
}) {
  return (
    <Animated.View
      entering={SlideInRight.duration(250).delay(delay)}
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
          {label}
        </Text>
        {description && <Text style={styles.rowDesc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: "rgba(255,255,255,0.1)",
          true: Colors.emerald + "60",
        }}
        thumbColor={value ? Colors.emerald : "#555"}
        disabled={disabled}
      />
    </Animated.View>
  );
}

function SegmentPicker<T extends string>({
  options,
  selected,
  onSelect,
  delay,
}: {
  options: { label: string; value: T; icon?: string }[];
  selected: T;
  onSelect: (v: T) => void;
  delay: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(250).delay(delay)}
      style={styles.segmentRow}
    >
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            {opt.icon && <Text style={styles.segmentIcon}>{opt.icon}</Text>}
            <Text
              style={[styles.segmentLabel, active && styles.segmentLabelActive]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

// ── Main ──
interface Props {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: Props) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { width: W } = useWindowDimensions();

  const allAnimsOff = settings.reducedMotion;

  return (
    <LinearGradient
      colors={["#060f1d", "#0a192f", "#0d1f2d"]}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: STATUS_BAR_H + 8 }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Settings</Text>
        <TouchableOpacity onPress={resetSettings} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── ANIMATION SECTION ─── */}
        <SectionHeader icon="🎬" title="Animations" delay={50} />

        <ToggleRow
          icon="🖐️"
          label="Win Slam"
          description="Hand slams the board when you win"
          value={settings.winSlamAnimation}
          onToggle={(v) => updateSetting("winSlamAnimation", v)}
          delay={80}
          disabled={allAnimsOff}
        />
        <ToggleRow
          icon="🎊"
          label="Confetti"
          description="Confetti burst on victory"
          value={settings.confettiAnimation}
          onToggle={(v) => updateSetting("confettiAnimation", v)}
          delay={110}
          disabled={allAnimsOff}
        />
        <ToggleRow
          icon="🎆"
          label="Fireworks"
          description="Fireworks explosion on win"
          value={settings.victoryFireworks}
          onToggle={(v) => updateSetting("victoryFireworks", v)}
          delay={140}
          disabled={allAnimsOff}
        />
        <ToggleRow
          icon="📳"
          label="Screen Shake"
          description="Shake on big plays"
          value={settings.screenShake}
          onToggle={(v) => updateSetting("screenShake", v)}
          delay={170}
          disabled={allAnimsOff}
        />
        <ToggleRow
          icon="✨"
          label="Domino Trails"
          description="Particle trail when dragging tiles"
          value={settings.dominoTrails}
          onToggle={(v) => updateSetting("dominoTrails", v)}
          delay={200}
          disabled={allAnimsOff}
        />
        <ToggleRow
          icon="😂"
          label="Funny Emojis"
          description="Emoji rain & reactions"
          value={settings.funnyEmojis}
          onToggle={(v) => updateSetting("funnyEmojis", v)}
          delay={230}
          disabled={allAnimsOff}
        />
        <ToggleRow
          icon="📳"
          label="Haptic Feedback"
          description="Vibration on plays & wins"
          value={settings.hapticFeedback}
          onToggle={(v) => updateSetting("hapticFeedback", v)}
          delay={260}
          disabled={allAnimsOff}
        />

        {/* Animation intensity */}
        <Animated.View
          entering={FadeInDown.duration(250).delay(280)}
          style={styles.subSection}
        >
          <Text style={[styles.rowLabel, { marginBottom: 8 }]}>
            Animation Intensity
          </Text>
          <SegmentPicker<AnimationIntensity>
            options={[
              { label: "Off", value: "off", icon: "⛔" },
              { label: "Minimal", value: "minimal", icon: "💫" },
              { label: "Full", value: "full", icon: "🔥" },
            ]}
            selected={settings.animationIntensity}
            onSelect={(v) => updateSetting("animationIntensity", v)}
            delay={300}
          />
        </Animated.View>

        {/* ─── QUALITY / PERFORMANCE SECTION ─── */}
        <SectionHeader icon="⚡" title="Quality & Performance" delay={320} />

        <Animated.View
          entering={FadeInDown.duration(250).delay(340)}
          style={styles.subSection}
        >
          <Text style={[styles.rowLabel, { marginBottom: 8 }]}>
            Render Quality
          </Text>
          <SegmentPicker<RenderQuality>
            options={[
              { label: "Low", value: "low", icon: "🔋" },
              { label: "Medium", value: "medium", icon: "⚡" },
              { label: "High", value: "high", icon: "✨" },
            ]}
            selected={settings.renderQuality}
            onSelect={(v) => updateSetting("renderQuality", v)}
            delay={360}
          />
          <Text style={styles.qualityHint}>
            {settings.renderQuality === "low"
              ? "Battery saver — fewer effects, lower resolution"
              : settings.renderQuality === "medium"
                ? "Balanced — good visuals, smooth performance"
                : "Maximum detail — shadows, high-res textures"}
          </Text>
        </Animated.View>

        <ToggleRow
          icon="♿"
          label="Reduced Motion"
          description="Disable ALL animations (accessibility)"
          value={settings.reducedMotion}
          onToggle={(v) => updateSetting("reducedMotion", v)}
          delay={380}
        />

        {/* ─── SOUND SECTION ─── */}
        <SectionHeader icon="🔊" title="Sound" delay={400} />

        <ToggleRow
          icon="🔈"
          label="Sound Effects"
          description="Play sounds on actions"
          value={settings.soundEnabled}
          onToggle={(v) => updateSetting("soundEnabled", v)}
          delay={420}
        />

        {/* Volume slider placeholder */}
        <Animated.View
          entering={FadeInDown.duration(250).delay(440)}
          style={styles.subSection}
        >
          <View style={styles.volumeRow}>
            <Text style={styles.rowIcon}>🔉</Text>
            <Text style={styles.rowLabel}>Volume</Text>
            <View style={styles.volumeTrack}>
              <View
                style={[
                  styles.volumeFill,
                  { width: `${settings.soundVolume * 100}%` },
                ]}
              />
            </View>
            <View style={styles.volumeBtns}>
              <TouchableOpacity
                onPress={() =>
                  updateSetting(
                    "soundVolume",
                    Math.max(0, settings.soundVolume - 0.1),
                  )
                }
              >
                <Text style={styles.volBtn}>−</Text>
              </TouchableOpacity>
              <Text style={styles.volVal}>
                {Math.round(settings.soundVolume * 100)}%
              </Text>
              <TouchableOpacity
                onPress={() =>
                  updateSetting(
                    "soundVolume",
                    Math.min(1, settings.soundVolume + 0.1),
                  )
                }
              >
                <Text style={styles.volBtn}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ─── ABOUT SECTION ─── */}
        <SectionHeader icon="ℹ️" title="About" delay={460} />
        <Animated.View
          entering={FadeInDown.duration(250).delay(480)}
          style={styles.aboutCard}
        >
          <Text style={styles.aboutTitle}>Domino WMS</Text>
          <Text style={styles.aboutVersion}>v1.0.0</Text>
          <Text style={styles.aboutDesc}>
            A real-time multiplayer domino game with 3D visuals.
          </Text>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.white10,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  backBtnText: {
    color: Colors.white80,
    fontWeight: "700",
    fontSize: 14,
  },
  headerTitle: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 18,
  },
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  resetBtnText: {
    color: "#fca5a5",
    fontWeight: "700",
    fontSize: 12,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Section
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
    gap: 8,
  },
  sectionIcon: { fontSize: 20 },
  sectionTitle: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
  },
  rowDisabled: { opacity: 0.4 },
  rowIcon: { fontSize: 20, width: 28, textAlign: "center" },
  rowContent: { flex: 1 },
  rowLabel: {
    color: Colors.white90,
    fontWeight: "700",
    fontSize: 14,
  },
  rowLabelDisabled: { color: Colors.white40 },
  rowDesc: {
    color: Colors.white40,
    fontSize: 11,
    marginTop: 2,
  },

  // Sub-section
  subSection: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },

  // Segment picker
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  segmentBtnActive: {
    backgroundColor: Colors.emerald + "25",
    borderColor: Colors.emerald + "50",
  },
  segmentIcon: { fontSize: 14 },
  segmentLabel: {
    color: Colors.white60,
    fontWeight: "700",
    fontSize: 12,
  },
  segmentLabelActive: {
    color: Colors.emeraldLight,
  },

  qualityHint: {
    color: Colors.white40,
    fontSize: 10,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },

  // Volume
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  volumeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  volumeFill: {
    height: "100%",
    backgroundColor: Colors.emerald,
    borderRadius: 3,
  },
  volumeBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  volBtn: {
    color: Colors.white80,
    fontWeight: "900",
    fontSize: 18,
    width: 24,
    textAlign: "center",
  },
  volVal: {
    color: Colors.white60,
    fontWeight: "700",
    fontSize: 11,
    width: 32,
    textAlign: "center",
  },

  // About
  aboutCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  aboutTitle: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 18,
  },
  aboutVersion: {
    color: Colors.emeraldLight,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
  },
  aboutDesc: {
    color: Colors.white40,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
});
