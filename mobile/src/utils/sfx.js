import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

const dingAsset = require("../../assets/sfx/ding.wav");
let dingSound = null;
let loadPromise = null;
let lastPlayedAt = 0;
const MIN_INTERVAL_MS = 350;

async function ensureDingLoaded() {
  if (dingSound) return dingSound;
  if (!loadPromise) {
    loadPromise = (async () => {
      // A calm app's sound effects respect the silent switch (owner, 2026-10-17; expo-audio defaults to playing on
      // silent) and never pause the person's own music or podcast.
      await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
      dingSound = createAudioPlayer(dingAsset);
      return dingSound;
    })();
  }
  return loadPromise;
}

export async function playDing() {
  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;
  try {
    const sound = await ensureDingLoaded();
    if (!sound) return;
    // expo-audio players stay at the end after playing; rewind so every ding plays from the start
    await sound.seekTo(0);
    sound.play();
  } catch (error) {
    if (__DEV__) {
      console.log("SFX_DING_ERROR", error);
    }
  }
}
