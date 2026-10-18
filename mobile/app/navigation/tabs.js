// The bottom tabs, in order (owner, 2026-10-15: "Today · Garden · Play · Wardrobe · You"). Route names stay as
// they were so existing navigate() calls keep working: "Home" reads as Today and "Pet" as You. Pure data, so
// the order and the labels are covered by a test (src/__tests__/tabs.test.ts) without rendering a navigator.
//
// Width: five tabs share a 375 pt phone, 75 pt each less the item's 5 pt padding a side. The longest label,
// "Wardrobe", is about 52 pt in Nunito Bold 11 (finchTabBarLabelStyle), so nothing is clipped.

/** @typedef {{ name: string, label: string, icon: string, petFace?: boolean }} TabSpec */

/** @type {TabSpec[]} `icon` is a Feather glyph; the You tab draws the pet's own face instead (PetTabIcon). */
export const TABS = [
  { name: "Home", label: "Today", icon: "sun" },
  { name: "Garden", label: "Garden", icon: "feather" },
  { name: "Play", label: "Play", icon: "play-circle" },
  { name: "Wardrobe", label: "Wardrobe", icon: "shopping-bag" },
  { name: "Pet", label: "You", icon: "heart", petFace: true },
];

export const TAB_NAMES = TABS.map((tab) => tab.name);

/** Whether a route name is one of the bottom tabs (rather than a screen on the stack above them). */
export function isTabRoute(name) {
  return typeof name === "string" && TAB_NAMES.includes(name);
}

/**
 * Opens a tab from anywhere. A tab screen can navigate to a sibling tab by name, but a screen on the stack
 * cannot see into the tabs, so it goes through "MainTabs" (which also pops back down to the tabs).
 * @param {{ navigate: (name: string, params?: object) => void }} navigation
 * @param {string} name a tab route name (TAB_NAMES); anything else is ignored
 * @param {object} [params] handed to the tab's screen
 */
export function navigateToTab(navigation, name, params) {
  if (!isTabRoute(name)) return;
  navigation.navigate("MainTabs", params === undefined ? { screen: name } : { screen: name, params });
}
