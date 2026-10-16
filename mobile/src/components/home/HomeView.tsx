import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import HomeHero, { type HomeHeroProps } from "./HomeHero";
import EnergyCheck from "./EnergyCheck";
import CareTrayHeader from "./CareTrayHeader";
import CareTaskCard from "./CareTaskCard";
import MoreCarousel, { type MoreItem } from "./MoreCarousel";
import WeekCard, { type WeekDay } from "./WeekCard";
import CareToast from "./CareToast";
import JourneyCard, { type JourneyCardProps } from "./JourneyCard";
import { AllDoneCard, FocusPromptCard, MemorialCard, SectionTitle } from "./HomeCards";
import type { Energy } from "../../domain/plan/types";
import { brand, radius, surfaceFor, type } from "../../theme/tokens";

export type HomeTask = {
  key: string;
  title: string;
  category: string;
  icon: string;
  minutes: number;
  reason: string | null;
  done: boolean;
  saving: boolean;
  notice: { type: "error" | "queued"; message: string } | null;
  /** opens its own screen (breathing, journal, a game) */
  opens: boolean;
};

export type HomeViewProps = Omit<HomeHeroProps, "height" | "petLine"> & {
  petLine: string | null;
  memorial: { reflection: string; onMemories: () => void; onQuiet: () => void; onCheckIn: () => void } | null;
  energy: Energy | null;
  onEnergy: (energy: Energy) => void;
  focusChosen: boolean;
  focusLabel: string | null;
  focusCategory: string | null;
  onOpenFocus: () => void;
  /** today's step of the active journey, shown at the top of today's care */
  journey?: Omit<JourneyCardProps, "surface"> | null;
  tasks: HomeTask[];
  loadingTasks: boolean;
  tasksError: string | null;
  onRetryTasks: () => void;
  onCompleteTask: (key: string, options?: { retry?: boolean }) => void;
  onOpenTask: (key: string) => void;
  more: MoreItem[];
  week: WeekDay[];
  loadingWeek: boolean;
  onOpenWeek: () => void;
  footerLinks: Array<{ label: string; onPress: () => void }>;
  toast: { id: number; text: string } | null;
  /** distance from the bottom of this view to keep the toast above (tab bar) */
  toastBottom?: number;
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * Home, as one composed screen: the pet's sanctuary up top, then a warm paper sheet with the battery
 * check, today's care (from the plan engine), more things to do with the pet, and the week. Pure: all
 * data and actions come in as props, so the real screen and the design preview render the same thing.
 */
export default function HomeView(props: HomeViewProps) {
  const { height } = useWindowDimensions();
  const surface = surfaceFor(props.phase);
  const heroHeight = Math.round(Math.min(520, Math.max(380, height * 0.5)));
  const done = props.tasks.filter((task) => task.done).length;
  const total = props.tasks.length;
  const allDone = total > 0 && done >= total;
  // undone first, done sink to the bottom; the plan's own order is kept within each group
  const ordered = [...props.tasks].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <View style={[styles.root, { backgroundColor: surface.canvas }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={brand.sprout} progressViewOffset={props.topInset} />}
      >
        <HomeHero {...props} height={heroHeight} petLine={props.memorial ? null : props.petLine} />

        <View style={[styles.sheet, { backgroundColor: surface.canvas }]}>
          {props.memorial ? (
            <MemorialCard {...props.memorial} surface={surface} />
          ) : (
            <>
              <EnergyCheck value={props.energy} onChange={props.onEnergy} surface={surface} petName={props.petName} />

              <View style={styles.tray}>
                <CareTrayHeader
                  title="Today's care"
                  done={done}
                  total={total}
                  focusLabel={props.focusLabel}
                  focusCategory={props.focusCategory}
                  onOpenFocus={props.onOpenFocus}
                  surface={surface}
                />
                {props.journey ? <JourneyCard {...props.journey} surface={surface} /> : null}
                {props.focusChosen ? null : <FocusPromptCard petName={props.petName} onPress={props.onOpenFocus} surface={surface} />}
                {allDone ? <AllDoneCard petName={props.petName} surface={surface} /> : null}
                {props.loadingTasks && total === 0 ? (
                  <ActivityIndicator color={brand.sprout} style={styles.loading} />
                ) : props.tasksError && total === 0 ? (
                  <Pressable onPress={props.onRetryTasks} accessibilityRole="button" style={[styles.errorCard, { backgroundColor: surface.paper }]}>
                    <Text style={[type.callout, { color: surface.text }]}>{props.tasksError}</Text>
                    <Text style={[type.meta, { color: brand.ember, marginTop: 4 }]}>Tap to try again</Text>
                  </Pressable>
                ) : (
                  ordered.map((task) => (
                    <CareTaskCard
                      key={task.key}
                      title={task.title}
                      category={task.category}
                      icon={task.icon}
                      minutes={task.minutes}
                      reason={task.reason}
                      done={task.done}
                      saving={task.saving}
                      notice={task.notice}
                      opens={task.opens}
                      onComplete={() => props.onCompleteTask(task.key)}
                      onOpen={() => props.onOpenTask(task.key)}
                      onRetry={() => props.onCompleteTask(task.key, { retry: true })}
                      surface={surface}
                    />
                  ))
                )}
              </View>

              <SectionTitle surface={surface}>More with {props.petName}</SectionTitle>
              <MoreCarousel items={props.more} surface={surface} />

              <View style={styles.week}>
                <WeekCard petName={props.petName} days={props.week} loading={props.loadingWeek} daysTogether={props.daysTogether} onPress={props.onOpenWeek} surface={surface} />
              </View>
            </>
          )}

          {props.footerLinks.length > 0 ? (
            <View style={styles.footer}>
              {props.footerLinks.map((link, index) => (
                <React.Fragment key={link.label}>
                  {index > 0 ? <Text style={[type.meta, { color: surface.textTertiary }]}> · </Text> : null}
                  <Pressable onPress={link.onPress} hitSlop={8} accessibilityRole="link">
                    <Text style={[type.meta, { color: surface.textSecondary }]}>{link.label}</Text>
                  </Pressable>
                </React.Fragment>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <CareToast toast={props.toast} bottom={props.toastBottom ?? 20} petSources={props.petSources} petLook={props.petLook} night={surface.isNight} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 40,
  },
  sheet: {
    marginTop: -30,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: "continuous",
    paddingTop: 22,
    paddingHorizontal: 20,
  },
  tray: {
    marginTop: 26,
  },
  loading: {
    marginVertical: 24,
  },
  errorCard: {
    padding: 16,
    borderRadius: radius.row,
  },
  week: {
    marginTop: 26,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
});
