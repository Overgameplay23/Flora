import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { setStatusBarStyle } from "expo-status-bar";
import { useTheme } from "../theme/theme";

/**
 * For tab screens whose painted scene runs under the status bar (Garden, Pet): the status bar follows the
 * scene's sky while the screen is in front, then goes back to the app-wide one (the paper of the hour).
 */
export function useSceneStatusBar(style: "dark" | "light") {
  const app = useTheme().statusBar;
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
      return () => setStatusBarStyle(app);
    }, [style, app])
  );
}
