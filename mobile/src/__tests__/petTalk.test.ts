import { TALK_MAX_MESSAGES, crisisReply, needsCrisisReply, openingLine, talkContextPayload, trimHistory } from "../domain/petTalk";
import { buildSystemPrompt, normalizeContext } from "../../supabase/functions/pet-talk/prompt";

describe("pet-talk prompt (server rules)", () => {
  it("speaks as the pet, knows the place, and carries the guardrails", () => {
    const prompt = buildSystemPrompt(normalizeContext({ petName: "Biscuit", species: "dog", hour: 9, checkedInToday: false }));
    expect(prompt).toContain("You are Biscuit");
    expect(prompt).toContain("is a dog");
    expect(prompt).toContain("lives in the garden");
    expect(prompt).toContain("never mention streaks");
    expect(prompt).toContain("never predict cycle phases");
    expect(prompt).toContain("crisis line");
    expect(prompt).toContain("It is morning.");
    expect(prompt).toContain("not checked in today");
    expect(prompt).not.toContain("cycle on their device");
  });

  it("changes character for cats, adopted companions and a memorial", () => {
    const cat = buildSystemPrompt(normalizeContext({ petName: "Mochi", species: "cat", adopted: true, cycleAware: true }));
    expect(cat).toContain("is a cat");
    expect(cat).toContain("window nook");
    expect(cat).toContain("adopted companion");
    expect(cat).toContain("never predict, estimate or explain their cycle");
    const memorial = buildSystemPrompt(normalizeContext({ petName: "Mochi", species: "cat", memorial: true }));
    expect(memorial).toContain("who has died");
    expect(memorial).toContain("No cheering");
  });

  it("uses the week lightly, never as a score, and bounds what the client sends", () => {
    const ctx = normalizeContext({
      petName: "  Biscuit  " + "x".repeat(50),
      species: "parrot",
      hour: 99,
      week: {
        headline: "A steady week, one small thing at a time.",
        noticed: ["Energy was mostly good.", "a", "b", "c", "d"],
        energyWord: "Good",
        activeDays: 40,
        kept: [{ weekday: "Thursday", text: "Called my sister." }, { text: "" }, 7],
      },
    });
    expect(ctx.petName).toHaveLength(24);
    expect(ctx.species).toBe("dog");
    expect(ctx.hour).toBe(23);
    expect(ctx.week?.noticed).toHaveLength(3);
    expect(ctx.week?.activeDays).toBe(7);
    expect(ctx.week?.kept).toEqual([{ weekday: "Thursday", text: "Called my sister." }]);
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("A steady week");
    expect(prompt).toContain("mostly good");
    expect(prompt).toContain("7 of the last 7 days (never mention this as a score)");
    expect(prompt).toContain('"Called my sister."');
  });
});

describe("pet-talk client pieces", () => {
  it("trims to the last turns and drops junk", () => {
    const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i} ` + "x".repeat(2000) })) as any;
    const trimmed = trimHistory([...long, { role: "system", content: "nope" } as any, { role: "user", content: "   " }]);
    expect(trimmed).toHaveLength(TALK_MAX_MESSAGES);
    expect(trimmed[trimmed.length - 1].content.startsWith("m29")).toBe(true);
    expect(trimmed.every((m) => m.content.length <= 800)).toBe(true);
  });

  it("sends only what the app holds", () => {
    const payload = talkContextPayload({ petName: "Biscuit", species: "dog", hour: 14, week: { headline: "h", noticed: ["n"], energyWord: "Good", activeDays: 3, kept: [{ dateKey: "2026-09-24", weekday: "Thursday", text: "t" }] } });
    expect(payload).toEqual({ petName: "Biscuit", species: "dog", adopted: false, memorial: false, hour: 14, checkedInToday: null, cycleAware: false, week: { headline: "h", noticed: ["n"], energyWord: "Good", activeDays: 3, kept: [{ weekday: "Thursday", text: "t" }] } });
  });

  it("recognises crisis language and answers with support, not the model", () => {
    expect(needsCrisisReply("I want to die")).toBe(true);
    expect(needsCrisisReply("I could kill for a coffee")).toBe(false);
    expect(crisisReply("Biscuit")).toContain("crisis line");
  });

  it("opens differently by time, place and memorial", () => {
    expect(openingLine({ petName: "Biscuit", species: "dog", hour: 8 })).toContain("Morning");
    expect(openingLine({ petName: "Mochi", species: "cat", hour: 20 })).toContain("rug");
    expect(openingLine({ petName: "Mochi", species: "cat", hour: 2 })).toContain("cats are");
    expect(openingLine({ petName: "Mochi", memorial: true })).toContain("quiet");
  });
});
