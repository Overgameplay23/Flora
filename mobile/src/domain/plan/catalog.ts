// The bundled task catalog for Plan Engine v1 (tasks map, section 5b). Pure and versioned in code like
// shelter.ts and reflection.ts, so copy, icons and pet lines can change without a migration.
//
// Rules the tests in src/__tests__/plan.test.ts hold this file to:
//   * Titles are what gets written to tasks.title, so they must stay stable once shipped; history is rebuilt
//     from them (catalogIdForTitle). The three seed titles and the "Play with " prefix (isPlayTask) are reused
//     exactly so existing rows and their points carry over.
//   * Cycle-care tasks are written to the database like any other, so their ids and titles are neutral
//     ("Cozy warmth break"), never naming the cycle (docs/dev-notes.md, cycle data stays on the device).
//   * lowEnergySafe tasks are effort 1 and 5 minutes or less; memorialSafe lines never speak as the pet.
import type { CatalogTask } from "./types";

export const PLAN_CATALOG: CatalogTask[] = [
  // ---------- body basics ----------
  {
    id: "body.water", title: "Drink water", tinyTitle: "Water", petLine: "One glass. Small sips count too.",
    focus: { body_basics: 1, burnout: 0.3 }, category: "nourish", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "water-outline", act: "drink", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "body.sunlight", title: "Go outside / get sunlight", tinyTitle: "Sunlight", petLine: "Five minutes of sky does more than it should.",
    focus: { body_basics: 0.7, low_mood: 0.6, sleep: 0.3, burnout: 0.3 }, category: "energy", kind: "tap", minutes: 5, effort: 2,
    dayParts: ["morning", "day"], icon: "sunny-outline", act: "walk", lowEnergySafe: false, memorialSafe: true,
  },
  {
    id: "body.warm_meal", title: "Eat something warm", tinyTitle: "Warm food", petLine: "Something warm in your belly. Toast counts.",
    focus: { body_basics: 1, burnout: 0.4, low_mood: 0.3 }, category: "nourish", kind: "tap", minutes: 10, effort: 2,
    dayParts: ["day", "evening"], icon: "restaurant-outline", act: "drink", lowEnergySafe: false, memorialSafe: true,
  },
  {
    id: "body.snack", title: "Have a small snack", tinyTitle: "Snack", petLine: "When did you last eat? A handful of anything helps.",
    focus: { body_basics: 0.8, burnout: 0.3, get_going: 0.2 }, category: "nourish", kind: "tap", minutes: 2, effort: 1, dayParts: "any",
    icon: "nutrition-outline", act: "drink", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "body.stretch", title: "Stretch for one minute", tinyTitle: "Stretch", petLine: "Reach up, fold down, shake it out.",
    focus: { body_basics: 0.8, burnout: 0.3, calm_mind: 0.2 }, category: "body", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "body-outline", act: "stretch", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "body.teeth", title: "Brush your teeth", tinyTitle: "Teeth", petLine: "Fresh mouth, fresh start. Two minutes is plenty.",
    focus: { body_basics: 0.7, sleep: 0.2, low_mood: 0.2 }, category: "body", kind: "tap", minutes: 2, effort: 1,
    dayParts: ["morning", "night"], icon: "sparkles-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "body.walk", title: "Take a 10-minute walk", tinyTitle: "Walk", petLine: "Ten minutes of moving and looking around. Tell me what you see.",
    focus: { body_basics: 0.7, low_mood: 0.7, calm_mind: 0.3, burnout: 0.2 }, category: "energy", kind: "timer", minutes: 10, effort: 3,
    dayParts: ["morning", "day", "evening"], icon: "walk-outline", act: "walk", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "body.fresh_clothes", title: "Change into fresh clothes", tinyTitle: "Fresh clothes", petLine: "Clean clothes are a small reset. Comfy ones count.",
    focus: { body_basics: 0.5, get_going: 0.5, low_mood: 0.4 }, category: "body", kind: "tap", minutes: 3, effort: 1,
    dayParts: ["morning", "day"], icon: "shirt-outline", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- calm mind ----------
  {
    id: "calm.box_breath", title: "Box breathing for one minute", tinyTitle: "Box breathing", petLine: "In for four, hold for four, out for four. Nothing else to do.",
    focus: { calm_mind: 1, sleep: 0.4, low_mood: 0.2 }, category: "calm", kind: "breathing", minutes: 1, effort: 1, dayParts: "any",
    icon: "cloud-outline", route: "Breathing", act: "breathe", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "calm.name_five", title: "Name 5 things you can see", tinyTitle: "Name five", petLine: "Five things you can see, out loud or in your head.",
    focus: { calm_mind: 1, low_mood: 0.3 }, category: "calm", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "eye-outline", act: "breathe", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "calm.worry_jar", title: "Put one worry in the jar", tinyTitle: "Worry jar", petLine: "Write the worry down. It can wait in the jar until tomorrow.",
    focus: { calm_mind: 1, sleep: 0.3 }, category: "calm", kind: "journal", minutes: 3, effort: 1, dayParts: "any",
    icon: "file-tray-outline", route: "Journal", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "calm.long_exhale", title: "Three long, slow exhales", tinyTitle: "Slow exhales", petLine: "Breathe out longer than you breathe in. Three times.",
    focus: { calm_mind: 0.8, burnout: 0.4, self_kindness: 0.2 }, category: "calm", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "cloudy-outline", act: "breathe", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "calm.unclench", title: "Drop your shoulders, unclench your jaw", tinyTitle: "Unclench", petLine: "Shoulders down, jaw loose, tongue off the roof of your mouth.",
    focus: { calm_mind: 0.8, burnout: 0.5 }, category: "calm", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "accessibility-outline", act: "stretch", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- burnout ----------
  {
    id: "rest.pause", title: "Take a guilt-free pause", tinyTitle: "Pause", petLine: "Two minutes where nothing needs fixing.",
    focus: { burnout: 1, self_kindness: 0.4, calm_mind: 0.3 }, category: "rest", kind: "timer", minutes: 2, effort: 1, dayParts: "any",
    icon: "pause-circle-outline", act: "sleep", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "rest.say_no", title: "Say no to one thing", tinyTitle: "Say no", petLine: "One thing off the list, on purpose. I'll back you up.",
    focus: { burnout: 1, self_kindness: 0.5 }, category: "rest", kind: "tap", minutes: 2, effort: 2,
    dayParts: ["morning", "day"], icon: "hand-left-outline", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "rest.do_nothing", title: "Do nothing for 10 minutes", tinyTitle: "Do nothing", petLine: "Ten minutes off. Lying on the floor is allowed. I do it all the time.",
    focus: { burnout: 1, calm_mind: 0.4 }, category: "rest", kind: "timer", minutes: 10, effort: 1,
    dayParts: ["day", "evening"], icon: "hourglass-outline", act: "sleep", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "rest.lie_down", title: "Lie down for five minutes", tinyTitle: "Lie down", petLine: "Five minutes flat. Rest is part of it.",
    focus: { burnout: 0.9, sleep: 0.3, low_mood: 0.3 }, category: "rest", kind: "timer", minutes: 5, effort: 1, dayParts: "any",
    icon: "bed-outline", act: "sleep", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "rest.let_wait", title: "Let one task wait until tomorrow", tinyTitle: "Let it wait", petLine: "Pick one thing that can wait, and let it.",
    focus: { burnout: 0.9, self_kindness: 0.4, get_going: 0.3 }, category: "rest", kind: "tap", minutes: 1, effort: 1,
    dayParts: ["day", "evening"], icon: "calendar-clear-outline", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- getting started ----------
  {
    id: "focus.ten_minutes", title: "10-minute focus session", tinyTitle: "Focus session", petLine: "Ten minutes on one thing. I'll sit right here until the timer ends.",
    focus: { get_going: 1, space_admin: 0.4 }, category: "focus", kind: "timer", minutes: 10, effort: 3,
    dayParts: ["morning", "day"], icon: "timer-outline", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "focus.just_open", title: "Just open it: one minute on the thing", tinyTitle: "Just open it", petLine: "Open the doc, the drawer, the email. One minute, then you can stop.",
    focus: { get_going: 1 }, category: "focus", kind: "tap", minutes: 1, effort: 1,
    dayParts: ["morning", "day"], icon: "folder-open-outline", lowEnergySafe: true, memorialSafe: false,
  },
  {
    id: "focus.brain_dump", title: "Brain-dump what's on your mind", tinyTitle: "Brain dump", petLine: "Everything out of your head and onto the page. No order needed.",
    focus: { get_going: 0.8, calm_mind: 0.6, space_admin: 0.3, sleep: 0.2 }, category: "focus", kind: "journal", minutes: 3, effort: 1, dayParts: "any",
    icon: "list-outline", route: "Journal", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "focus.body_double", title: "Work alongside {pet} for 5 minutes", tinyTitle: "Work together", petLine: "You do the thing, I'll keep you company. Five minutes.",
    focus: { get_going: 1, space_admin: 0.3 }, category: "focus", kind: "timer", minutes: 5, effort: 2,
    dayParts: ["morning", "day"], icon: "paw-outline", act: "stretch", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "focus.one_thing", title: "Choose the one thing for today", tinyTitle: "One thing", petLine: "If only one thing gets done today, which one?",
    focus: { get_going: 0.9, space_admin: 0.4, burnout: 0.2 }, category: "focus", kind: "tap", minutes: 1, effort: 1,
    dayParts: ["morning", "day"], icon: "checkbox-outline", lowEnergySafe: true, memorialSafe: false,
  },

  // ---------- sleep ----------
  {
    id: "sleep.dim_lights", title: "Dim the lights", tinyTitle: "Dim lights", petLine: "Lower lights tell your body the day is winding down.",
    focus: { sleep: 1, calm_mind: 0.2 }, category: "rest", kind: "tap", minutes: 1, effort: 1,
    dayParts: ["evening", "night"], icon: "bulb-outline", act: "sleep", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "sleep.phone_bed", title: "Put your phone to bed", tinyTitle: "Phone to bed", petLine: "Phone on the charger, across the room. I'll take it from here.",
    focus: { sleep: 1, burnout: 0.3 }, category: "rest", kind: "tap", minutes: 1, effort: 2,
    dayParts: ["night"], icon: "phone-portrait-outline", act: "sleep", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "sleep.slow_breath", title: "A minute of slow breathing before bed", tinyTitle: "Bedtime breathing", petLine: "Slow, square breaths. Let the day get quieter.",
    focus: { sleep: 1, calm_mind: 0.6 }, category: "rest", kind: "breathing", minutes: 1, effort: 1,
    dayParts: ["evening", "night"], icon: "moon-outline", route: "Breathing", act: "breathe", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "sleep.wind_down", title: "Wind down for 10 minutes", tinyTitle: "Wind down", petLine: "No screens, low light, something slow. I'm already yawning.",
    focus: { sleep: 1, calm_mind: 0.5, burnout: 0.3 }, category: "rest", kind: "timer", minutes: 10, effort: 2,
    dayParts: ["evening", "night"], icon: "cloudy-night-outline", act: "sleep", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "sleep.tomorrow_note", title: "Jot down one thing for tomorrow", tinyTitle: "Note for tomorrow", petLine: "Write it down so your head doesn't have to hold it overnight.",
    focus: { sleep: 0.8, get_going: 0.4, calm_mind: 0.3 }, category: "rest", kind: "journal", minutes: 2, effort: 1,
    dayParts: ["evening", "night"], icon: "create-outline", route: "Journal", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "sleep.curtains", title: "Open the curtains", tinyTitle: "Curtains", petLine: "Morning light helps tonight's sleep. Let it in.",
    focus: { sleep: 0.7, low_mood: 0.6, body_basics: 0.2 }, category: "energy", kind: "tap", minutes: 1, effort: 1,
    dayParts: ["morning"], icon: "partly-sunny-outline", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- self-kindness ----------
  {
    id: "kind.rewrite", title: "Rewrite one harsh thought", tinyTitle: "Rewrite a thought", petLine: "Catch one mean thought and write the fairer version.",
    focus: { self_kindness: 1, calm_mind: 0.4, low_mood: 0.3 }, category: "nourish", kind: "journal", minutes: 3, effort: 2, dayParts: "any",
    icon: "pencil-outline", route: "Journal", lowEnergySafe: false, memorialSafe: true,
  },
  {
    id: "kind.compliment", title: "Give yourself one honest compliment", tinyTitle: "A compliment", petLine: "One true, kind thing about you. It can be small.",
    focus: { self_kindness: 1, low_mood: 0.4 }, category: "nourish", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "heart-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "kind.hand_heart", title: "Breathe with a hand on your heart", tinyTitle: "Hand on heart", petLine: "Hand on your chest, slow breaths, a minute on your own side.",
    focus: { self_kindness: 0.9, calm_mind: 0.6 }, category: "calm", kind: "breathing", minutes: 1, effort: 1, dayParts: "any",
    icon: "heart-circle-outline", route: "Breathing", act: "breathe", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "kind.done_list", title: "Write three things you already did today", tinyTitle: "Already done", petLine: "Three things you did today. Getting up counts.",
    focus: { self_kindness: 0.9, low_mood: 0.5, get_going: 0.2 }, category: "nourish", kind: "journal", minutes: 2, effort: 1,
    dayParts: ["day", "evening", "night"], icon: "ribbon-outline", route: "Journal", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "kind.friend_voice", title: "Talk to yourself like a friend would", tinyTitle: "Friend voice", petLine: "What would you say to a friend having this day? Say it to you.",
    focus: { self_kindness: 1, low_mood: 0.3 }, category: "nourish", kind: "tap", minutes: 2, effort: 1, dayParts: "any",
    icon: "chatbubble-ellipses-outline", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- low mood ----------
  {
    id: "lift.window", title: "Open a window", tinyTitle: "Window", petLine: "A little fresh air changes the room more than you'd think.",
    focus: { low_mood: 1, calm_mind: 0.3, body_basics: 0.2 }, category: "energy", kind: "tap", minutes: 1, effort: 1,
    dayParts: ["morning", "day", "evening"], icon: "browsers-outline", act: "breathe", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "lift.song", title: "Put on one song you love", tinyTitle: "One song", petLine: "One song, loud or quiet. Dancing is optional.",
    focus: { low_mood: 1, burnout: 0.3, get_going: 0.2 }, category: "energy", kind: "tap", minutes: 4, effort: 1, dayParts: "any",
    icon: "musical-notes-outline", act: "stretch", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "lift.pet_photo", title: "Send someone a photo of {pet}", tinyTitle: "Share a photo", petLine: "Pick a good one of me and send it to someone who'll smile.",
    focus: { low_mood: 0.8, connection: 0.8 }, category: "connection", kind: "tap", minutes: 2, effort: 1,
    dayParts: ["day", "evening"], icon: "camera-outline", lowEnergySafe: true, memorialSafe: false,
  },
  {
    id: "lift.check_in", title: "Do a quick check-in", tinyTitle: "Check-in", petLine: "How's your battery today? One tap is enough.",
    focus: { low_mood: 0.7, calm_mind: 0.4, self_kindness: 0.3, burnout: 0.3 }, category: "calm", kind: "checkin", minutes: 1, effort: 1, dayParts: "any",
    icon: "happy-outline", route: "CheckIn", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "lift.small_joy", title: "Do one small thing you enjoy", tinyTitle: "Small joy", petLine: "Something just for the fun of it. Five minutes is enough.",
    focus: { low_mood: 0.9, burnout: 0.4, self_kindness: 0.3 }, category: "energy", kind: "tap", minutes: 5, effort: 1, dayParts: "any",
    icon: "star-outline", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- connection ----------
  {
    id: "connect.reply", title: "Reply to one message", tinyTitle: "Reply", petLine: "Just one. A short reply is still a reply.",
    focus: { connection: 1, space_admin: 0.4 }, category: "connection", kind: "tap", minutes: 2, effort: 1,
    dayParts: ["day", "evening"], icon: "chatbubble-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "connect.say_hi", title: "Text a friend just to say hi", tinyTitle: "Say hi", petLine: "No reason needed. \"Thinking of you\" is a whole message.",
    focus: { connection: 1, low_mood: 0.4 }, category: "connection", kind: "tap", minutes: 2, effort: 1,
    dayParts: ["day", "evening"], icon: "paper-plane-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "connect.plan_meet", title: "Make a plan to see someone", tinyTitle: "Make a plan", petLine: "A walk, a coffee, a call. Put one on the calendar.",
    focus: { connection: 1, low_mood: 0.3 }, category: "connection", kind: "tap", minutes: 5, effort: 3,
    dayParts: ["day", "evening"], icon: "calendar-outline", lowEnergySafe: false, memorialSafe: true,
  },
  {
    id: "connect.thank", title: "Thank someone, even for something small", tinyTitle: "Say thanks", petLine: "Thanks for the coffee, the help, the silly video. It lands.",
    focus: { connection: 0.9, low_mood: 0.3, self_kindness: 0.2 }, category: "connection", kind: "tap", minutes: 2, effort: 1,
    dayParts: ["day", "evening"], icon: "mail-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "connect.good_memory", title: "Write down one good memory", tinyTitle: "Good memory", petLine: "One moment worth keeping. Who was there?",
    focus: { connection: 0.6, low_mood: 0.5, self_kindness: 0.3 }, category: "connection", kind: "journal", minutes: 3, effort: 1, dayParts: "any",
    icon: "book-outline", route: "Journal", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- space and life admin ----------
  {
    id: "space.one_surface", title: "Clear one surface", tinyTitle: "One surface", petLine: "One table, one shelf, one chair. Just that one.",
    focus: { space_admin: 1, get_going: 0.3, calm_mind: 0.2 }, category: "energy", kind: "tap", minutes: 5, effort: 2,
    dayParts: ["morning", "day", "evening"], icon: "sparkles-outline", lowEnergySafe: false, memorialSafe: true,
  },
  {
    id: "space.tidy_race", title: "Five-minute tidy race with {pet}", tinyTitle: "Tidy race", petLine: "Timer on. You tidy, I cheer. Go!",
    focus: { space_admin: 1, get_going: 0.5, low_mood: 0.2 }, category: "energy", kind: "timer", minutes: 5, effort: 2,
    dayParts: ["day", "evening"], icon: "stopwatch-outline", act: "walk", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "space.one_admin", title: "Deal with one bill or email", tinyTitle: "One admin task", petLine: "The one you keep avoiding. Open it, do it, done. I'll wait.",
    focus: { space_admin: 1, get_going: 0.6 }, category: "focus", kind: "tap", minutes: 10, effort: 3,
    dayParts: ["morning", "day"], icon: "mail-open-outline", lowEnergySafe: false, memorialSafe: false,
  },
  {
    id: "space.put_away", title: "Put away three things", tinyTitle: "Put away three", petLine: "Three things back where they live. That's the whole task.",
    focus: { space_admin: 0.9, get_going: 0.4 }, category: "energy", kind: "tap", minutes: 2, effort: 1,
    dayParts: ["morning", "day", "evening"], icon: "cube-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "space.laundry", title: "Start a load of laundry", tinyTitle: "Laundry", petLine: "Just start it. Folding is a problem for later.",
    focus: { space_admin: 0.8, body_basics: 0.2 }, category: "energy", kind: "tap", minutes: 3, effort: 1,
    dayParts: ["morning", "day"], icon: "basket-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "space.make_bed", title: "Make your bed", tinyTitle: "Make the bed", petLine: "Pull the covers up. Neat enough is neat.",
    focus: { space_admin: 0.8, get_going: 0.3, sleep: 0.2 }, category: "energy", kind: "tap", minutes: 2, effort: 1,
    dayParts: ["morning"], icon: "bed-outline", lowEnergySafe: true, memorialSafe: true,
  },

  // ---------- rhythm care (neutral ids and titles: these rows reach the database) ----------
  {
    id: "cozy.warmth", title: "Cozy warmth break", tinyTitle: "Warmth break", petLine: "Something warm on your belly or back, a blanket, feet up.",
    focus: { cycle: 1 }, category: "cycle", kind: "tap", minutes: 5, effort: 1, dayParts: "any",
    icon: "flame-outline", act: "sleep", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "cozy.lower_bar", title: "Lower the bar today", tinyTitle: "Lower the bar", petLine: "Pick one thing that can be smaller today. Smaller still counts.",
    focus: { cycle: 1 }, category: "cycle", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "trending-down-outline", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "cozy.warm_drink", title: "Sip something warm", tinyTitle: "Warm drink", petLine: "Tea, broth or warm water with lemon. Slow sips.",
    focus: { cycle: 1 }, category: "cycle", kind: "tap", minutes: 3, effort: 1, dayParts: "any",
    icon: "cafe-outline", act: "drink", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "cozy.iron", title: "Eat something iron-rich", tinyTitle: "Iron-rich bite", petLine: "Greens, beans, lentils or a square of dark chocolate.",
    focus: { cycle: 1 }, category: "cycle", kind: "tap", minutes: 5, effort: 1,
    dayParts: ["day", "evening"], icon: "nutrition-outline", act: "drink", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "cozy.hip_stretch", title: "Gentle hip stretch", tinyTitle: "Hip stretch", petLine: "Knees wide, sink back, breathe. Three slow minutes.",
    focus: { cycle: 1 }, category: "cycle", kind: "timer", minutes: 3, effort: 1, dayParts: "any",
    icon: "body-outline", act: "stretch", lowEnergySafe: true, memorialSafe: true,
  },
  {
    id: "cozy.body_note", title: "A quick body note", tinyTitle: "Body note", petLine: "Note how your body feels today. Patterns show up over time.",
    focus: { cycle: 1 }, category: "cycle", kind: "tap", minutes: 1, effort: 1, dayParts: "any",
    icon: "clipboard-outline", route: "Cycle", lowEnergySafe: true, memorialSafe: false,
  },

  // ---------- play (title prefix is how isPlayTask finds it after a game) ----------
  {
    id: "pet.play", title: "Play with {pet}", tinyTitle: "Playtime", petLine: "Two minutes of play, you and me? I'll bring the toy.",
    focus: { low_mood: 0.4, connection: 0.3, burnout: 0.3, calm_mind: 0.2 }, category: "play", kind: "play", minutes: 2, effort: 1, dayParts: "any",
    icon: "tennisball-outline", route: "PlayFetch", act: "walk", lowEnergySafe: true, memorialSafe: false,
  },

  // ---------- deeper practices (Floura Club; dropped from the plan unless premium) ----------
  {
    id: "calm.body_scan", title: "Slow body scan", tinyTitle: "Body scan", petLine: "Head to toes, noticing without fixing. Ten quiet minutes.",
    focus: { sleep: 0.8, calm_mind: 0.8, burnout: 0.4 }, category: "calm", kind: "timer", minutes: 10, effort: 1,
    dayParts: ["evening", "night"], icon: "pulse-outline", act: "breathe", lowEnergySafe: false, memorialSafe: true, premium: true,
  },
  {
    id: "kind.future_letter", title: "Write a letter to future you", tinyTitle: "Letter to you", petLine: "Tell future you what you're getting through right now.",
    focus: { self_kindness: 1, low_mood: 0.3 }, category: "nourish", kind: "journal", minutes: 10, effort: 2,
    dayParts: ["day", "evening", "night"], icon: "document-text-outline", route: "Journal", lowEnergySafe: false, memorialSafe: true, premium: true,
  },
];

const BY_ID = new Map<string, CatalogTask>(PLAN_CATALOG.map((task) => [task.id, task]));

export function catalogById(id: string): CatalogTask | undefined {
  return BY_ID.get(id);
}

function petNameOrDefault(petName: string | null | undefined) {
  // same fallback as playTaskTitle (src/games/playStatsLogic.ts), so rendered titles match rows it created
  return String(petName || "").trim() || "your pet";
}

/** The title as it is shown and written to tasks.title. */
export function renderTitle(task: CatalogTask, petName: string): string {
  // a function, not a string: a name like "Ca$$ie" must not be read as a "$" replacement pattern
  const name = petNameOrDefault(petName);
  return task.title.replace(/\{pet\}/g, () => name);
}

/** The pet's line for the card, with the pet's name filled in. */
export function renderPetLine(task: CatalogTask, petName: string): string {
  const name = petNameOrDefault(petName);
  return task.petLine.replace(/\{pet\}/g, () => name);
}

function normalizeTitle(title: unknown) {
  return String(title ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EXACT_TITLES = new Map<string, string>();
const PET_TEMPLATES: Array<{ id: string; pattern: RegExp }> = [];
for (const task of PLAN_CATALOG) {
  const normalized = normalizeTitle(task.title);
  if (!normalized.includes("{pet}")) {
    EXACT_TITLES.set(normalized, task.id);
    continue;
  }
  // "{pet}" matches any name, so a row written before the pet was renamed still maps back
  const pattern = new RegExp(`^${normalized.split("{pet}").map(escapeRegExp).join("(.+)")}$`);
  PET_TEMPLATES.push({ id: task.id, pattern });
}

/**
 * Reverse lookup from a tasks.title back to its catalog id, used to rebuild history from database rows.
 * Case and spacing are ignored; titles with {pet} match the current name first, then any name.
 */
export function catalogIdForTitle(title: string, petName?: string): string | undefined {
  const normalized = normalizeTitle(title);
  if (!normalized) return undefined;
  const exact = EXACT_TITLES.get(normalized);
  if (exact) return exact;
  if (petName != null) {
    for (const { id } of PET_TEMPLATES) {
      const task = BY_ID.get(id);
      if (task && normalizeTitle(renderTitle(task, petName)) === normalized) return id;
    }
  }
  return PET_TEMPLATES.find(({ pattern }) => pattern.test(normalized))?.id;
}
