import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import Sheet from "../common/Sheet";
import Card from "../common/Card";
import Chip from "../common/Chip";
import Button from "../common/Button";
import { Eyebrow, Lead } from "../common/Headings";
import { useTheme, type AppTheme } from "../../theme/theme";
import { brand, fonts, radius, type } from "../../theme/tokens";
import {
  MEND_NEEDED,
  PACE_OPTIONS,
  PAUSE_OPTIONS,
  STAMP_LEGEND,
  blanketsLine,
  careDayKey,
  chapterLine,
  chapterRange,
  cozyRunHeadline,
  dayLabel,
  dayOfMonth,
  daysTogetherLine,
  milestoneLine,
  mendLine,
  napsLeftLine,
  pauseOptionLabel,
  runSubline,
  shortDayLabel,
  stampLabel,
  stampWeeks,
  type CozyDayKind,
  type CozyPace,
  type CozyRunResult,
} from "../../domain/cozyRun";

type CozyRunSheetProps = {
  visible: boolean;
  onClose: () => void;
  petName: string;
  /** computeCozyRun's result */
  result: CozyRunResult;
  pace: CozyPace;
  onPace: (pace: CozyPace) => void;
  /** a Cozy Pause is running today */
  paused: boolean;
  onPause: (days: number) => void;
  onEndPause: () => void;
};

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];
const LEGEND_ORDER: CozyDayKind[] = ["showed_up", "nap", "blanket", "covered", "paused", "open"];
const DEFAULT_PAUSE_DAYS = 3;
const STAMP_SIZE = 32;

/**
 * The Cozy Run, opened from Home: the run and Days Together, four weeks of scrapbook stamps (a petal for
 * a care day, the pet's sleeping moon for a nap, a blanket, a soft pause, a gentle pink day, blank paper),
 * what is folded and ready, the pace, and a Cozy Pause. Never red, never an X, never a countdown (R9).
 */
export default function CozyRunSheet({ visible, onClose, petName, result, pace, onPace, paused, onPause, onEndPause }: CozyRunSheetProps) {
  const theme = useTheme();
  const { surface } = theme;
  const [pauseDays, setPauseDays] = useState<number>(DEFAULT_PAUSE_DAYS);
  // start from the default each time the sheet opens, and only then (data landing behind it must not reset a pick)
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) setPauseDays(DEFAULT_PAUSE_DAYS);
    wasVisible.current = visible;
  }, [visible]);

  const today = result.days.length > 0 ? result.days[result.days.length - 1].day : careDayKey();
  const weeks = useMemo(() => stampWeeks(result.days, today), [result.days, today]);
  const legend = useMemo(() => {
    const seen = new Set<CozyDayKind>(["showed_up"]);
    for (const row of weeks) for (const cell of row) if (cell.kind) seen.add(cell.kind === "today_open" ? "open" : cell.kind);
    return LEGEND_ORDER.filter((kind) => seen.has(kind));
  }, [weeks]);

  const paceOption = PACE_OPTIONS.find((option) => option.id === pace) ?? PACE_OPTIONS[1];
  const mend = mendLine(result, petName);
  const milestone = milestoneLine(result.nextMilestone);
  const chapters = result.chapters.map((chapter, index) => ({ chapter, index })).slice(-3).reverse();
  const mood = paused ? "sleepy" : result.run.todayCounted ? "happy" : "calm";
  const mendAccent = theme.tone("connection").accent;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={cozyRunHeadline(result.run.length)}
      subtitle={daysTogetherLine(result.daysTogether)}
      pet={{ mood, size: 72 }}
      footer={<Button label="Done" variant="secondary" onPress={onClose} />}
    >
      <Lead style={styles.subline}>{runSubline(result, petName)}</Lead>

      <Card style={styles.calendar}>
        <View style={styles.weekRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <Text key={`${initial}-${index}`} style={[type.micro, styles.weekday, { color: surface.textTertiary }]}>
              {initial}
            </Text>
          ))}
        </View>
        {weeks.map((row) => (
          <View key={row[0].day} style={styles.weekRow}>
            {row.map((cell) =>
              cell.kind == null ? (
                <View key={cell.day} style={styles.cell} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Stamp kind={null} theme={theme} />
                  <Text style={[styles.date, { color: surface.textTertiary, opacity: 0.5 }]}>{dayOfMonth(cell.day)}</Text>
                </View>
              ) : (
                <View
                  key={cell.day}
                  style={styles.cell}
                  accessible
                  accessibilityLabel={`${dayLabel(cell.day)}${cell.isToday ? ", today" : ""}: ${stampLabel(cell.kind, petName)}`}
                >
                  <Stamp kind={cell.kind} theme={theme} />
                  <Text
                    style={[
                      styles.date,
                      cell.isToday ? { color: surface.text, fontFamily: fonts.bodyHeavy } : { color: surface.textTertiary },
                    ]}
                  >
                    {cell.isToday ? "Today" : dayOfMonth(cell.day)}
                  </Text>
                </View>
              )
            )}
          </View>
        ))}
        <View style={[styles.legend, { borderTopColor: surface.hairline }]}>
          {legend.map((kind) => (
            <View key={kind} style={styles.legendItem} accessible accessibilityLabel={`${STAMP_LEGEND[kind]}: ${stampLabel(kind, petName)}`}>
              <Stamp kind={kind} theme={theme} size={16} />
              <Text style={[type.meta, { color: surface.textSecondary }]}>{STAMP_LEGEND[kind]}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.supplies}>
        <View style={styles.supplyRow} accessible accessibilityLabel={napsLeftLine(result.run.napsLeftThisWeek, petName)}>
          <Stamp kind="nap" theme={theme} size={24} />
          <Text style={[type.callout, styles.supplyText, { color: surface.text }]}>{napsLeftLine(result.run.napsLeftThisWeek, petName)}</Text>
        </View>
        <View style={styles.supplyRow} accessible accessibilityLabel={blanketsLine(result.run.blankets)}>
          <Stamp kind="blanket" theme={theme} size={24} />
          <Text style={[type.callout, styles.supplyText, { color: surface.text }]}>{blanketsLine(result.run.blankets)}</Text>
        </View>
      </View>

      {mend ? (
        <Card tone="connection" style={styles.block}>
          <Text style={[type.h3, { color: surface.text }]} accessibilityRole="header">
            Pick up the thread
          </Text>
          <Text style={[type.callout, styles.blockText, { color: surface.textSecondary }]}>{mend}</Text>
          <View style={styles.dots} accessible accessibilityLabel={`${result.mend.progress} of ${MEND_NEEDED} days back`}>
            {Array.from({ length: MEND_NEEDED }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, { borderColor: mendAccent, backgroundColor: i < result.mend.progress ? mendAccent : "transparent" }]}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <Eyebrow style={styles.eyebrow}>Your pace</Eyebrow>
      <View style={styles.chips}>
        {PACE_OPTIONS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            category="rest"
            selected={option.id === pace}
            onPress={() => {
              if (option.id !== pace) onPace(option.id);
            }}
            accessibilityLabel={`${option.label}, ${option.naps === 1 ? "1 nap" : `${option.naps} naps`} a week`}
          />
        ))}
      </View>
      <Lead style={styles.paceBlurb}>{paceOption.blurb}</Lead>

      <Card variant="sunken" style={styles.block}>
        {paused ? (
          <>
            <Text style={[type.h3, { color: surface.text }]} accessibilityRole="header">
              Cozy Pause is on
            </Text>
            <Text style={[type.callout, styles.blockText, { color: surface.textSecondary }]}>
              {result.pausedUntil ? `Resting until ${shortDayLabel(result.pausedUntil)}. ` : ""}
              {result.run.length > 0
                ? `${petName || "Your pet"} is keeping your run warm, and it picks up again the first day you come back.`
                : `${petName || "Your pet"} is resting with you. A new run starts the first day you come back.`}
            </Text>
            <Button label="I'm back" icon="sunny-outline" variant="secondary" size="md" onPress={onEndPause} containerStyle={styles.blockButton} />
          </>
        ) : (
          <>
            <Text style={[type.h3, { color: surface.text }]} accessibilityRole="header">
              Need a break?
            </Text>
            <Text style={[type.callout, styles.blockText, { color: surface.textSecondary }]}>
              Feeling sick, traveling or just worn out? Pause your run for a while. Nothing is spent, and it picks up
              again the first day you come back.
            </Text>
            <View style={styles.chips}>
              {PAUSE_OPTIONS.map((days) => (
                <Chip
                  key={days}
                  label={pauseOptionLabel(days)}
                  category="calm"
                  selected={days === pauseDays}
                  onPress={() => setPauseDays(days)}
                  accessibilityLabel={`Pause for ${pauseOptionLabel(days)}`}
                />
              ))}
            </View>
            <Button
              label={`Pause for ${pauseOptionLabel(pauseDays)}`}
              icon="moon-outline"
              variant="secondary"
              size="md"
              onPress={() => onPause(pauseDays)}
              containerStyle={styles.blockButton}
            />
          </>
        )}
      </Card>

      {chapters.length > 0 ? (
        <View style={styles.chapters}>
          <Eyebrow style={styles.eyebrow}>Scrapbook chapters</Eyebrow>
          {chapters.map(({ chapter, index }) => (
            <View key={chapter.from} style={styles.chapterRow} accessible accessibilityLabel={`${chapterLine(index, chapter, petName)}, ${chapterRange(chapter)}`}>
              <Stamp kind="showed_up" theme={theme} size={20} />
              <View style={styles.chapterText}>
                <Text style={[type.bodyStrong, { color: surface.text }]}>{chapterLine(index, chapter, petName)}</Text>
                <Text style={[type.meta, { color: surface.textSecondary }]}>{chapterRange(chapter)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {milestone ? (
        <View style={styles.milestone} accessible accessibilityLabel={milestone}>
          <Ionicons name={"gift-outline" as any} size={18} color={theme.night ? brand.gold : brand.goldStrong} />
          <Text style={[type.callout, styles.milestoneText, { color: surface.text }]}>{milestone}</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

// ---- stamps ----------------------------------------------------------------------------------------------
// Drawn on a 32 x 32 grid. Colours come from the theme so the stamps sit right on day and night paper.

function Stamp({ kind, theme, size = STAMP_SIZE }: { kind: CozyDayKind | null; theme: AppTheme; size?: number }) {
  const { surface, night } = theme;
  const tone = (category: string) => theme.tone(category);
  const soft = (category: string) => (night ? "rgba(255,255,255,0.08)" : tone(category).tint);
  let art: React.ReactNode;
  switch (kind) {
    case "showed_up": {
      // a filled blossom in sprout green
      const petal = night ? tone("body").mid : brand.sprout;
      art = (
        <>
          {[0, 72, 144, 216, 288].map((angle) => (
            <G key={angle} transform={`rotate(${angle} 16 16)`}>
              <Ellipse cx={16} cy={9.6} rx={4.7} ry={6.3} fill={petal} />
            </G>
          ))}
          <Circle cx={16} cy={16} r={3.4} fill={night ? surface.paper : brand.cream} />
        </>
      );
      break;
    }
    case "nap": {
      // the pet's sleeping moon: a crescent cut from the stamp's own colour, and a small z
      const bg = soft("rest");
      const ink = tone("rest").accent;
      art = (
        <>
          <Circle cx={16} cy={16} r={15} fill={bg} />
          <Circle cx={14.5} cy={17.2} r={7.4} fill={ink} />
          <Circle cx={17.8} cy={14.4} r={6.3} fill={bg} />
          <Path d="M20.5 7.5h4.4l-4.4 4.6h4.4" stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
      break;
    }
    case "blanket": {
      const ink = night ? tone("energy").tint : tone("energy").strong;
      art = (
        <>
          <Circle cx={16} cy={16} r={15} fill={soft("energy")} />
          <Rect x={7} y={9} width={18} height={14} rx={3} fill={tone("energy").mid} />
          <Path d="M9.5 12h13" stroke={ink} strokeWidth={1.2} strokeDasharray="1.6 1.6" strokeLinecap="round" />
          <Line x1={7.5} y1={16.5} x2={24.5} y2={16.5} stroke={ink} strokeWidth={1.1} opacity={0.5} />
          <Line x1={7.5} y1={19.5} x2={24.5} y2={19.5} stroke={ink} strokeWidth={1.1} opacity={0.5} />
        </>
      );
      break;
    }
    case "paused":
      art = (
        <>
          <Circle cx={16} cy={16} r={15} fill={surface.track} />
          <Rect x={11.8} y={10.5} width={3} height={11} rx={1.5} fill={surface.textTertiary} />
          <Rect x={17.2} y={10.5} width={3} height={11} rx={1.5} fill={surface.textTertiary} />
        </>
      );
      break;
    case "covered":
      // gentle pink, a small heart; nothing on it says why the day was covered
      art = (
        <>
          <Circle cx={16} cy={16} r={15} fill={night ? "rgba(224,158,192,0.22)" : tone("cycle").tint} />
          <Path
            d="M16 22.6c-.4 0-.8-.2-1.1-.4-3.3-2.5-5.4-4.5-5.4-7.2 0-2 1.5-3.5 3.4-3.5 1.2 0 2.3.6 3.1 1.6.8-1 1.9-1.6 3.1-1.6 1.9 0 3.4 1.5 3.4 3.5 0 2.7-2.1 4.7-5.4 7.2-.3.2-.7.4-1.1.4z"
            fill={tone("cycle").mid}
          />
        </>
      );
      break;
    case "today_open":
      art = <Circle cx={16} cy={16} r={14} fill={surface.paper} stroke={theme.bloom} strokeWidth={2} strokeDasharray="3 3.2" />;
      break;
    case "open":
      // blank paper
      art = <Circle cx={16} cy={16} r={14.25} fill={surface.paper} stroke={surface.track} strokeWidth={1.5} />;
      break;
    default:
      // a day still ahead this week
      art = <Circle cx={16} cy={16} r={2.5} fill={surface.track} />;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      {art}
    </Svg>
  );
}

const styles = StyleSheet.create({
  subline: {
    marginTop: -6,
    marginBottom: 14,
  },
  calendar: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  weekRow: {
    flexDirection: "row",
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    marginBottom: 6,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  date: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  supplies: {
    marginTop: 14,
    gap: 8,
  },
  supplyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  supplyText: {
    flex: 1,
  },
  block: {
    marginTop: 18,
  },
  blockText: {
    marginTop: 6,
    marginBottom: 12,
  },
  blockButton: {
    marginTop: 12,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  eyebrow: {
    marginTop: 22,
    marginBottom: 10,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  paceBlurb: {
    marginTop: 8,
  },
  chapters: {
    marginTop: 4,
  },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  chapterText: {
    flex: 1,
  },
  milestone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  milestoneText: {
    flex: 1,
  },
});
