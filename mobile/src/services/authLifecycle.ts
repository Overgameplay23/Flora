import { AppState, Platform } from "react-native";
import { supabase } from "../lib/supabase";

/** React Native has no browser visibility events; refresh only while the app is active. */
export function watchAuthLifecycle(): () => void {
  if (Platform.OS === "web") return () => {};
  const update = (state: string) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  update(AppState.currentState);
  const subscription = AppState.addEventListener("change", update);
  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
