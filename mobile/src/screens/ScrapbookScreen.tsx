// The Sunday scrapbook: once a week the pet keeps one page about the week (product strategy, weekly loop:
// "[Pet] put together your weekly scrapbook"). The newest page is put together from the week's check-ins and
// daily roll-up plus the journeys and milestones on this phone, then kept on the device so the book grows;
// earlier pages open from the book as they were kept. Observations, never verdicts; nothing counts a miss.
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { usePet } from "../hooks/usePet";
import PetMascot from "../components/pet/PetMascot";
import { PetEmptyState, PetLoading } from "../components/pet/PetMoments";
import Screen from "../components/common/Screen";
import Button from "../components/common/Button";
import IconTile from "../components/common/IconTile";
import { Eyebrow, SectionTitle } from "../components/common/Headings";
import { ListGroup, ListRow } from "../components/common/ListGroup";
import { useTheme } from "../theme/theme";
import { fonts, radius, type } from "../theme/tokens";
import { fetchWeeklyCheckins, markWeeklyReflectionViewed } from "../services/dailyLoop";
import { fetchDailyMetrics } from "../services/retention";
import { loadCarePrefs } from "../services/carePrefs";
import { loadJourneyState } from "../services/journeyStore";
import { loadMilestones } from "../services/milestoneStore";
import { keepScrapbookPage, loadScrapbook, markScrapbookSeen } from "../services/scrapbookStore";
import { loadKeptChapters } from "../services/cozyRunStore";
import { buildWeekStory } from "../domain/week";
import { buildScrapbookPage, earlierPages, hasPageFor, latestPageEnd, pageFor, type Scrapbook, type ScrapbookPage } from "../domain/scrapbook";
import { addDaysToDateKey, getISOWeekKey, getLocalDateKey } from "../utils/dateKeys";

/** The page's colour: connection rose, as "Our week". */
const PAGE_CATEGORY = "connection";
/** a slight tilt per sticker and note, the way things get stuck into a scrapbook (static, not motion) */
const TILTS = ["-1.6deg", "1.2deg", "-0.8deg", "1.8deg", "-1.2deg", "0.6deg"];

function Tape({ side, color }: { side: "left" | "right"; color: string }) {
  return <View pointerEvents="none" style={[styles.tape, side === "left" ? styles.tapeLeft : styles.tapeRight, { backgroundColor: color }]} />;
}

function PageView({ page, petName, latest }: { page: ScrapbookPage; petName: string; latest: boolean }) {
  const theme = useTheme();
  const { surface } = theme;
  const tone = theme.tone(PAGE_CATEGORY);
  const today = getLocalDateKey();
  const stillOpen = latest && page.endDateKey === today && !page.memorial;
  const thisWeek = today >= page.startDateKey && today <= page.endDateKey;
  const keptCount = page.kept.length + page.moreKept;

  return (
    <View style={[styles.page, { backgroundColor: surface.paper, boxShadow: surface.shadowRaised }]}>
      <Tape side="left" color={theme.tone("play").mid} />
      <Tape side="right" color={tone.mid} />
      <Eyebrow color={tone.accent}>{page.memorial ? `Remembering ${petName}` : `${petName} put this together`}</Eyebrow>
      <Text style={[type.title, styles.range, { color: surface.text }]} accessibilityRole="header">
        {page.range}
      </Text>

      <View style={styles.head}>
        <View style={[styles.polaroid, { backgroundColor: surface.canvas, boxShadow: surface.shadow }]}>
          <View style={[styles.polaroidPhoto, { backgroundColor: tone.fill }]}>
            <PetMascot size={84} mood={page.memorial ? "calm" : page.activeDays > 0 ? "happy" : "calm"} showShadow={false} night={theme.night} />
          </View>
          <Text style={[type.micro, styles.polaroidCaption, { color: surface.textSecondary }]} numberOfLines={1}>
            {thisWeek ? `${petName}, this week` : petName}
          </Text>
        </View>
        <Text style={[type.petVoice, styles.note, { color: surface.text }]}>{page.note}</Text>
      </View>

      {page.stickers.length > 0 ? (
        <View style={styles.stickers}>
          {page.stickers.map((sticker, index) => {
            const stickerTone = theme.tone(sticker.category);
            return (
              <View
                key={sticker.id}
                style={[styles.sticker, { backgroundColor: stickerTone.fill, borderColor: stickerTone.mid, transform: [{ rotate: TILTS[index % TILTS.length] }] }]}
                accessible
                accessibilityLabel={sticker.detail ? `${sticker.label}. ${sticker.detail}` : sticker.label}
              >
                <IconTile icon={sticker.icon} category={sticker.category} on="fill" size={36} round />
                <View style={styles.stickerBody}>
                  <Text style={[type.callout, styles.stickerLabel, { color: surface.text }]}>{sticker.label}</Text>
                  {sticker.detail ? <Text style={[type.meta, { color: surface.textSecondary }]}>{sticker.detail}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.keptHead}>
        <Text style={[type.h3, { color: surface.text }]}>Kept</Text>
        {keptCount > 0 ? (
          <Text style={[type.meta, { color: surface.textSecondary }]}>
            {keptCount} {keptCount === 1 ? "win" : "wins"}
          </Text>
        ) : null}
      </View>
      {page.kept.length === 0 ? (
        <Text style={[type.callout, { color: surface.textSecondary }]}>
          {page.memorial ? "Nothing written down this week." : "No wins written down this week. A check-in can keep one, however small."}
        </Text>
      ) : (
        page.kept.map((note, index) => (
          <View
            key={`${note.weekday}:${index}`}
            style={[styles.keptNote, { backgroundColor: theme.night ? surface.sunken : tone.tint, transform: [{ rotate: TILTS[(index + 3) % TILTS.length] }] }]}
          >
            <View pointerEvents="none" style={[styles.keptTape, { backgroundColor: theme.tone("play").mid }]} />
            <Text style={[type.micro, { color: tone.accent }]}>{note.weekday.toUpperCase()}</Text>
            <Text style={[type.callout, styles.keptText, { color: surface.text }]}>{note.text}</Text>
          </View>
        ))
      )}
      {page.moreKept > 0 ? (
        <Text style={[type.meta, styles.more, { color: surface.textSecondary }]}>
          And {page.moreKept} more in the week's check-ins.
        </Text>
      ) : null}

      <Text style={[type.petVoice, styles.closing, { color: surface.textSecondary }]}>
        {stillOpen ? `${petName} keeps adding to this page until tonight.` : "Nothing to fix, just a look back."}
      </Text>
    </View>
  );
}

export default function ScrapbookScreen() {
  const { user, setProfile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const requestedEnd: string | null = typeof route.params?.endDateKey === "string" ? route.params.endDateKey : null;
  const { displayName, memorial } = usePet();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState<ScrapbookPage | null>(null);
  const [book, setBook] = useState<Scrapbook | null>(null);
  const [firstPageAhead, setFirstPageAhead] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const userId = user.id;
    const today = getLocalDateKey();
    const [stored, prefs, journeys, milestones, cozyChapters] = await Promise.all([
      loadScrapbook(userId),
      loadCarePrefs(userId),
      loadJourneyState(userId),
      loadMilestones(userId),
      loadKeptChapters(userId),
    ]);
    setBook(stored);

    // an earlier page opens from the book, exactly as it was kept
    if (requestedEnd) {
      setPage(pageFor(stored, requestedEnd));
      setLoading(false);
      return;
    }

    const end = latestPageEnd(today);
    const firstDay = prefs.completedAt ? prefs.completedAt.slice(0, 10) : null;
    if (!hasPageFor(end, firstDay)) {
      setFirstPageAhead(true);
      setLoading(false);
      return;
    }
    setFirstPageAhead(false);
    try {
      setErrorMessage("");
      const [checkins, metrics] = await Promise.all([fetchWeeklyCheckins(userId, end), fetchDailyMetrics(addDaysToDateKey(end, -6), end)]);
      const story = buildWeekStory({ endDateKey: end, checkins, metrics, petName: displayName, memorial: !!memorial });
      const built = buildScrapbookPage({ story, petName: displayName, voice: prefs.voice, memorial: !!memorial, journeys, milestones, cozyChapters, madeAt: new Date().toISOString() });
      setPage(built);
      setBook(await keepScrapbookPage(userId, built));
      // on its Sunday the page is this week's look back, so Profile's "Our week" stops saying New too
      if (end === today) {
        const viewedWeek = await markWeeklyReflectionViewed(userId, getISOWeekKey(new Date())).catch(() => null);
        if (viewedWeek) setProfile?.((prev: any) => ({ ...(prev || {}), last_reflection_viewed_week: viewedWeek }));
      }
    } catch (error: any) {
      console.warn("SCRAPBOOK_LOAD_ERROR", error?.message || String(error));
      // keep the page on screen, or the one already in the book; never make a quiet week up out of a failed request
      const kept = pageFor(stored, end);
      setErrorMessage(kept ? "Couldn't reach the week just now. This is the page as it was kept." : "Couldn't reach the week just now.");
      if (kept) {
        setPage((prev) => prev ?? kept);
        setBook(await markScrapbookSeen(userId, end));
      }
    } finally {
      setLoading(false);
    }
  }, [displayName, memorial, requestedEnd, setProfile, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!user?.id) {
    return (
      <Screen scroll={false} centered>
        <PetEmptyState title="Sign in to see the scrapbook." mood="calm" />
      </Screen>
    );
  }
  if (loading && !page) {
    return (
      <Screen scroll={false} centered>
        <PetLoading label="Turning to this week's page" />
      </Screen>
    );
  }
  if (firstPageAhead && !requestedEnd) {
    return (
      <Screen scroll={false} centered>
        <PetEmptyState
          title="The first page comes on Sunday."
          body={`Every Sunday ${displayName} keeps one page about the week: what you wrote down, the days that were fuller, the ones that felt heavier.`}
          mood="happy"
        />
      </Screen>
    );
  }
  if (!page) {
    return (
      <Screen scroll={false} centered>
        {requestedEnd ? (
          <PetEmptyState title="That page isn't in the book on this phone." body="Pages are kept on the device they were made on." mood="calm" />
        ) : (
          <>
            <PetEmptyState title="Couldn't reach the week just now." body="Your days are safe. Try again in a moment." mood="calm" />
            <Button
              label="Try again"
              icon="refresh-outline"
              variant="secondary"
              size="md"
              onPress={() => {
                setLoading(true);
                void load();
              }}
              accessibilityLabel="Try loading the page again"
              containerStyle={styles.retry}
            />
          </>
        )}
      </Screen>
    );
  }

  const earlier = book && !requestedEnd ? earlierPages(book, page.endDateKey) : [];

  return (
    <Screen bottomPad={48}>
      {errorMessage ? <Text style={[type.meta, styles.error, { color: theme.alert }]}>{errorMessage}</Text> : null}
      <PageView page={page} petName={displayName} latest={!requestedEnd} />
      {earlier.length > 0 ? (
        <>
          <SectionTitle style={styles.earlierTitle}>Earlier pages</SectionTitle>
          <ListGroup>
            {earlier.map((p) => {
              const wins = p.kept.length + p.moreKept;
              return (
                <ListRow
                  key={p.endDateKey}
                  icon="images-outline"
                  category={PAGE_CATEGORY}
                  label={p.range}
                  hint={wins > 0 ? `${wins} ${wins === 1 ? "win" : "wins"} kept` : p.note}
                  onPress={() => navigation.push("Scrapbook", { endDateKey: p.endDateKey })}
                />
              );
            })}
          </ListGroup>
        </>
      ) : null}
      {!requestedEnd && !page.memorial ? (
        <Button
          label="See the week day by day"
          icon="book-outline"
          variant="secondary"
          size="sm"
          onPress={() => navigation.navigate("WeeklyReflection")}
          accessibilityLabel="Open Our week"
          containerStyle={styles.weekButton}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { marginBottom: 10, marginLeft: 4 },
  retry: { marginTop: 16, alignSelf: "center" },
  page: {
    borderRadius: radius.hero,
    borderCurve: "continuous",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 20,
    marginTop: 6,
  },
  tape: { position: "absolute", top: -7, width: 64, height: 18, borderRadius: 3, opacity: 0.7 },
  tapeLeft: { left: 22, transform: [{ rotate: "-7deg" }] },
  tapeRight: { right: 22, transform: [{ rotate: "6deg" }] },
  range: { marginTop: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 },
  polaroid: { padding: 7, paddingBottom: 6, borderRadius: 6, transform: [{ rotate: "-3deg" }] },
  polaroidPhoto: { width: 104, height: 104, borderRadius: 3, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  polaroidCaption: { marginTop: 5, textAlign: "center", maxWidth: 104 },
  note: { flex: 1 },
  stickers: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  sticker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: radius.chip,
    borderCurve: "continuous",
    borderWidth: 1,
    maxWidth: "100%",
  },
  stickerBody: { flexShrink: 1 },
  stickerLabel: { fontFamily: fonts.bodyBold },
  keptHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  keptNote: { borderRadius: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, marginBottom: 12 },
  keptTape: { position: "absolute", top: -6, alignSelf: "center", left: "40%", width: 46, height: 14, borderRadius: 2, opacity: 0.65 },
  keptText: { marginTop: 3 },
  more: { marginTop: 2 },
  closing: { marginTop: 18, textAlign: "center" },
  earlierTitle: { marginTop: 24 },
  weekButton: { marginTop: 18, alignSelf: "center" },
});
