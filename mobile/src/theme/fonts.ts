import { useFonts } from "expo-font";
import { Fraunces_500Medium, Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

/**
 * Loads the two families the tokens name (src/theme/tokens.ts `fonts`). Returns true once they are
 * ready, or once loading failed: the app then carries on in the system font rather than staying blank.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  return loaded || !!error;
}
