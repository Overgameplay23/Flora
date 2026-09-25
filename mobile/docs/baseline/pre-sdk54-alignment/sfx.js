import { Audio } from "expo-av";

const dingAsset = require("../../assets/sfx/ding.wav");
let dingSound = null;
let loadPromise = null;
let lastPlayedAt = 0;
const MIN_INTERVAL_MS = 350;

async function ensureDingLoaded() {
  if (dingSound) return dingSound;
  if (!loadPromise) {
    loadPromise = (async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(dingAsset, { shouldPlay: false });
      dingSound = sound;
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
    await sound.replayAsync();
  } catch (error) {
    if (__DEV__) {
      console.log("SFX_DING_ERROR", error);
    }
  }
}
