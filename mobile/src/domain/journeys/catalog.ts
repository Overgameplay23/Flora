// Journeys: seven-day arcs, one per focus area (docs/ROADMAP.md, "Retention and depth"). Each day has a theme,
// a line from the pet and one task from the plan catalog (src/domain/plan/catalog.ts), so a journey step is
// completed through the same tasks row and complete_task as any other care task. A few days add a journal
// prompt. Pure content, versioned in code; ids and task ids are held to the tests in src/__tests__/journeys.test.ts.
// A journey may have a sequel ("Part two", `sequelOf` names part one): the same area, seven more days, offered
// once part one has been walked. The three most-picked areas (sleep, calm_mind, burnout) have one.
//
// Voice: a warm adult friend. The pet speaks in the first person, never scolds, never counts what was missed.
import type { CareCategory, FocusArea } from "../plan/types";

export type JourneyDay = {
  title: string;
  /** what the pet says about today's step; may contain {pet} */
  petLine: string;
  /** a task id from the plan catalog */
  taskId: string;
  /** an optional journal question for the day */
  prompt?: string;
};

export type Journey = {
  id: string;
  area: FocusArea;
  title: string;
  blurb: string;
  /** Ionicons glyph */
  icon: string;
  category: CareCategory;
  days: JourneyDay[];
  /** part two: the id of the journey this one continues; listed once that one is walked */
  sequelOf?: string;
};

export const JOURNEY_DAYS = 7;

export const JOURNEYS: Journey[] = [
  {
    id: "calm.back_to_the_room",
    area: "calm_mind",
    title: "Back to the room",
    blurb: "Seven small ways to slow the spin and land back in the present.",
    icon: "leaf-outline",
    category: "calm",
    days: [
      { title: "Arrive", petLine: "We start by noticing where we are. Nothing to fix yet.", taskId: "calm.name_five", prompt: "What is one thing in the room that is actually fine right now?" },
      { title: "Breathe out longer", petLine: "A long exhale tells your body the coast is clear.", taskId: "calm.long_exhale" },
      { title: "Unclench", petLine: "Shoulders down, jaw soft. I'll do it with you.", taskId: "calm.unclench" },
      { title: "One worry, one jar", petLine: "Worries get smaller once they're written down.", taskId: "calm.worry_jar" },
      { title: "Box breathing", petLine: "Four in, four hold, four out. I count, you breathe.", taskId: "calm.box_breath" },
      { title: "Hand on heart", petLine: "A little warmth for the part of you that is tired of worrying.", taskId: "kind.hand_heart" },
      { title: "Slow scan", petLine: "Ten minutes, head to toes. Then we're done.", taskId: "calm.body_scan", prompt: "Which of this week's small calms would you keep?" },
    ],
  },
  {
    id: "rest.refill_the_cup",
    area: "burnout",
    title: "Refill the cup",
    blurb: "Permission to pause, one day at a time, until there is something in the tank again.",
    icon: "battery-charging-outline",
    category: "rest",
    days: [
      { title: "Permission", petLine: "Rest isn't earned. It's allowed.", taskId: "rest.pause" },
      { title: "Let one thing wait", petLine: "Tomorrow can have it. Today is full enough.", taskId: "rest.let_wait" },
      { title: "Lie down", petLine: "Five minutes flat. No phone, no plan.", taskId: "rest.lie_down" },
      { title: "A small no", petLine: "One small no makes room for one small yes.", taskId: "rest.say_no" },
      { title: "Something warm", petLine: "Running on empty makes everything louder. Eat something warm.", taskId: "body.warm_meal" },
      { title: "Do nothing", petLine: "Ten minutes of nothing. Harder than it sounds. I'll keep you company.", taskId: "rest.do_nothing" },
      { title: "What refilled you", petLine: "Look back at the week. Some of it helped.", taskId: "kind.done_list", prompt: "What gave you energy this week, and what quietly took it?" },
    ],
  },
  {
    id: "focus.tiny_first_steps",
    area: "get_going",
    title: "Tiny first steps",
    blurb: "For the weeks when starting is the hard part: one small start a day.",
    icon: "footsteps-outline",
    category: "focus",
    days: [
      { title: "Just open it", petLine: "Starting is the whole battle. One minute counts.", taskId: "focus.just_open" },
      { title: "The one thing", petLine: "Pick one. Not the biggest, the clearest.", taskId: "focus.one_thing" },
      { title: "Empty your head", petLine: "Get it out of your head and onto the page.", taskId: "focus.brain_dump" },
      { title: "Sit with me", petLine: "I'll stay beside you for five minutes. You start, I stay.", taskId: "focus.body_double" },
      { title: "Fresh start", petLine: "A small reset for your body helps the rest follow.", taskId: "body.fresh_clothes" },
      { title: "Ten minutes", petLine: "A real session, short enough to finish.", taskId: "focus.ten_minutes" },
      { title: "Look what moved", petLine: "Starting got a little easier this week. Notice it.", taskId: "kind.done_list", prompt: "What was easier to start by the end of the week?" },
    ],
  },
  {
    id: "sleep.softer_landing",
    area: "sleep",
    title: "A softer landing",
    blurb: "Seven evenings of small changes, for nights that come easier.",
    icon: "moon-outline",
    category: "rest",
    days: [
      { title: "Dim the lights", petLine: "Evening starts when the lights go down.", taskId: "sleep.dim_lights" },
      { title: "Tomorrow's note", petLine: "Write it down, so your head can put it down.", taskId: "sleep.tomorrow_note" },
      { title: "Phone to bed", petLine: "Yours gets a bedtime too.", taskId: "sleep.phone_bed" },
      { title: "Slow breaths", petLine: "A minute of slow breathing, then lights out.", taskId: "sleep.slow_breath" },
      { title: "Morning light", petLine: "Opening the curtains in the morning sets tonight up.", taskId: "sleep.curtains" },
      { title: "Wind down", petLine: "Ten minutes between the day and the bed.", taskId: "sleep.wind_down" },
      { title: "Your own rhythm", petLine: "You found a few things that help. Keep the ones that fit.", taskId: "sleep.dim_lights", prompt: "Which evening was easiest to fall asleep after, and what was different about it?" },
    ],
  },
  {
    id: "body.the_basics",
    area: "body_basics",
    title: "The basics hold everything up",
    blurb: "Water, food, a stretch and some sky: the quiet foundations, one a day.",
    icon: "body-outline",
    category: "body",
    days: [
      { title: "Water first", petLine: "One glass. Small sips count.", taskId: "body.water" },
      { title: "A small snack", petLine: "When did you last eat? A handful of anything helps.", taskId: "body.snack" },
      { title: "Stretch", petLine: "Reach up, fold down, shake it out.", taskId: "body.stretch" },
      { title: "Some sky", petLine: "Five minutes outside does more than you'd think.", taskId: "body.sunlight" },
      { title: "Fresh start", petLine: "Two minutes with a toothbrush is a whole reset.", taskId: "body.teeth" },
      { title: "Something warm", petLine: "A warm meal, or toast. Toast counts.", taskId: "body.warm_meal" },
      { title: "A short walk", petLine: "Ten minutes of moving and looking around. Tell me what you see.", taskId: "body.walk", prompt: "What did your body thank you for this week?" },
    ],
  },
  {
    id: "kind.a_kinder_voice",
    area: "self_kindness",
    title: "A kinder voice",
    blurb: "Practice talking to yourself the way you would talk to a friend. Seven days of it.",
    icon: "heart-outline",
    category: "nourish",
    days: [
      { title: "One honest compliment", petLine: "Say one true, kind thing about yourself. Out loud is allowed.", taskId: "kind.compliment" },
      { title: "A friend's voice", petLine: "Whatever you'd say to a friend today, say it to you.", taskId: "kind.friend_voice" },
      { title: "Rewrite one thought", petLine: "Take the harshest line of the day and write it gentler.", taskId: "kind.rewrite" },
      { title: "Hand on heart", petLine: "A minute of warmth for yourself. You deserve the same care you give.", taskId: "kind.hand_heart" },
      { title: "Already done", petLine: "Three things you already did today. They count.", taskId: "kind.done_list" },
      { title: "A small joy", petLine: "Something you enjoy, just because you do.", taskId: "lift.small_joy" },
      { title: "A letter to future you", petLine: "Tell future you what you've learned this week.", taskId: "kind.future_letter", prompt: "What would you want to remember about how you treated yourself this week?" },
    ],
  },
  {
    id: "lift.little_lights",
    area: "low_mood",
    title: "Little lights",
    blurb: "Small lights for heavy days: light, air, a song, a person.",
    icon: "sunny-outline",
    category: "energy",
    days: [
      { title: "Light first", petLine: "Open the curtains. Let the day in a little.", taskId: "sleep.curtains" },
      { title: "Fresh air", petLine: "One window, one breath of outside.", taskId: "lift.window" },
      { title: "One song", petLine: "Put on one song you love. I'll dance badly.", taskId: "lift.song" },
      { title: "Some sky", petLine: "Five minutes outside. The sky doesn't need you to feel better first.", taskId: "body.sunlight" },
      { title: "A small joy", petLine: "One small thing you enjoy, no reason needed.", taskId: "lift.small_joy" },
      { title: "Just say hi", petLine: "Text someone just to say hi. Nothing else required.", taskId: "connect.say_hi" },
      { title: "A good memory", petLine: "Write down one good memory. It's still yours.", taskId: "connect.good_memory", prompt: "Which small light helped most this week?" },
    ],
  },
  {
    id: "cozy.gentle_days",
    area: "cycle",
    title: "Gentle days",
    blurb: "Comfort and a lower bar for the days your body asks for them. Private, like the rest of your rhythm.",
    icon: "flower-outline",
    category: "cycle",
    days: [
      { title: "A quick note", petLine: "One line about how your body feels today. That's all.", taskId: "cozy.body_note" },
      { title: "Something warm", petLine: "Sip something warm and slow down for a minute.", taskId: "cozy.warm_drink" },
      { title: "Lower the bar", petLine: "Today's bar is on the floor, and that's fine.", taskId: "cozy.lower_bar" },
      { title: "Warmth break", petLine: "A blanket, a hot water bottle, five minutes.", taskId: "cozy.warmth" },
      { title: "Gentle hips", petLine: "Three slow minutes of stretching, nothing heroic.", taskId: "cozy.hip_stretch" },
      { title: "Iron-rich", petLine: "Something iron-rich today. Your body will use it.", taskId: "cozy.iron" },
      { title: "Lie down", petLine: "Five minutes flat. You've looked after yourself all week.", taskId: "rest.lie_down", prompt: "What did your body ask for this week, and what helped?" },
    ],
  },
  {
    id: "connect.less_alone",
    area: "connection",
    title: "Less alone",
    blurb: "Easy ways to reach out, even when your social battery is low.",
    icon: "people-outline",
    category: "connection",
    days: [
      { title: "One reply", petLine: "Reply to one message. Short is fine.", taskId: "connect.reply" },
      { title: "A thank you", petLine: "Thank someone, even for something small.", taskId: "connect.thank" },
      { title: "A photo of me", petLine: "Send someone a photo of me. I'm very photogenic.", taskId: "lift.pet_photo" },
      { title: "Just say hi", petLine: "Text a friend just to say hi. No reason needed.", taskId: "connect.say_hi" },
      { title: "A good memory", petLine: "Write down one good memory with someone.", taskId: "connect.good_memory" },
      { title: "Play with me", petLine: "Connection counts with me too. Two minutes of play?", taskId: "pet.play" },
      { title: "Make a plan", petLine: "Make a plan to see someone. It can be small and soon.", taskId: "connect.plan_meet", prompt: "Who made you feel a little less alone this week?" },
    ],
  },
  {
    id: "space.one_surface",
    area: "space_admin",
    title: "One surface at a time",
    blurb: "Small wins against the pile: one surface, one email, one load.",
    icon: "home-outline",
    category: "focus",
    days: [
      { title: "Three things", petLine: "Put away three things. Just three.", taskId: "space.put_away" },
      { title: "Make the bed", petLine: "One made bed makes the whole room look kinder.", taskId: "space.make_bed" },
      { title: "One surface", petLine: "Clear one surface. Not the room, one surface.", taskId: "space.one_surface" },
      { title: "Start a load", petLine: "Start the laundry. The machine does the rest.", taskId: "space.laundry" },
      { title: "Tidy race", petLine: "Five minutes, timer on. I'll run around too.", taskId: "space.tidy_race" },
      { title: "One bill or email", petLine: "The one you've been avoiding. Ten minutes, then it's gone.", taskId: "space.one_admin" },
      { title: "What's left", petLine: "Write down what's left, so it stops living in your head.", taskId: "focus.brain_dump", prompt: "Which small win made the biggest difference to your space?" },
    ],
  },

  // ---------- part two: sequels, offered once part one is walked ----------
  {
    id: "sleep.softer_landing_2",
    sequelOf: "sleep.softer_landing",
    area: "sleep",
    title: "Both ends of the day",
    blurb: "Part two of A softer landing: mornings that start softer make nights that land easier.",
    icon: "partly-sunny-outline",
    category: "rest",
    days: [
      { title: "Morning light", petLine: "Open the curtains before anything else. Tonight starts now.", taskId: "sleep.curtains" },
      { title: "Water first", petLine: "A glass of water before the coffee. Your body wakes up kinder.", taskId: "body.water" },
      { title: "Some sky", petLine: "Five minutes outside in daylight sets your clock for tonight.", taskId: "body.sunlight" },
      { title: "A stretch", petLine: "One minute of stretching shakes the day loose.", taskId: "body.stretch" },
      { title: "Phone to bed, again", petLine: "You know this one. Yours sleeps in another room tonight.", taskId: "sleep.phone_bed" },
      { title: "Wind down", petLine: "Ten minutes between the day and the pillow. I'll be there.", taskId: "sleep.wind_down" },
      { title: "Slow breaths", petLine: "A minute of slow breathing, then lights out. Look how far you've come.", taskId: "sleep.slow_breath", prompt: "Which morning change made the evening easier?" },
    ],
  },
  {
    id: "calm.back_to_the_room_2",
    sequelOf: "calm.back_to_the_room",
    area: "calm_mind",
    title: "Staying in the room",
    blurb: "Part two of Back to the room: the calms you found, carried into the rest of the day.",
    icon: "cloud-outline",
    category: "calm",
    days: [
      { title: "Three exhales, anywhere", petLine: "The long exhale works in a queue, in a meeting, in bed. Try it somewhere new.", taskId: "calm.long_exhale" },
      { title: "Let the room breathe", petLine: "Open a window. The room gets some air, and so do you.", taskId: "lift.window" },
      { title: "Walk it loose", petLine: "Ten minutes of walking lets the spin settle on its own.", taskId: "body.walk" },
      { title: "Everything out", petLine: "Pour the whole swirl onto a page. It's smaller on paper.", taskId: "focus.brain_dump" },
      { title: "A pause with no job", petLine: "Nothing to fix for a few minutes. Just a pause, with me.", taskId: "rest.pause" },
      { title: "Four, four, four", petLine: "You know box breathing now. Four in, four hold, four out.", taskId: "calm.box_breath" },
      { title: "Still here", petLine: "Head to toes, slowly. Then notice: you're still in the room.", taskId: "calm.body_scan", prompt: "Which calm came quickest this time, and where did you use it?" },
    ],
  },
  {
    id: "rest.refill_the_cup_2",
    sequelOf: "rest.refill_the_cup",
    area: "burnout",
    title: "Keeping it filled",
    blurb: "Part two of Refill the cup: small habits that keep something in the tank.",
    icon: "cafe-outline",
    category: "rest",
    days: [
      { title: "A pause before you need one", petLine: "Rest before you're empty. That's the whole trick.", taskId: "rest.pause" },
      { title: "Some sky", petLine: "Five minutes of sky, no reason, no phone.", taskId: "body.sunlight" },
      { title: "Tomorrow can have it", petLine: "One thing waits until tomorrow. It will keep.", taskId: "rest.let_wait" },
      { title: "One song", petLine: "Put on one song you love and do nothing else for its length.", taskId: "lift.song" },
      { title: "Lie down", petLine: "Five minutes flat. Not asleep, not busy. Just flat.", taskId: "rest.lie_down" },
      { title: "A small no", petLine: "One no today. Hear how much room it makes.", taskId: "rest.say_no" },
      { title: "A note to future you", petLine: "Tell future you what keeps the cup full. They'll need reminding.", taskId: "kind.future_letter", prompt: "What kept something in the tank this week, and how could it stay?" },
    ],
  },
];

export function journeyById(id: string | null | undefined): Journey | undefined {
  if (!id) return undefined;
  return JOURNEYS.find((journey) => journey.id === id);
}

/** Part two of a journey, if it has one. */
export function sequelFor(journeyId: string | null | undefined): Journey | undefined {
  if (!journeyId) return undefined;
  return JOURNEYS.find((journey) => journey.sequelOf === journeyId);
}

/** The journey a sequel continues; undefined for a part one. */
export function partOneOf(journey: Journey | null | undefined): Journey | undefined {
  return journey?.sequelOf ? journeyById(journey.sequelOf) : undefined;
}
