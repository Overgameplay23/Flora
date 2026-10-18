import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import PetScreen from '../screens/PetScreen';
import ProfileScreen from '../screens/ProfileScreen';
import GardenProgressScreen from '../../src/screens/GardenProgressScreen';
import PetStylizeLoadingScreen from '../screens/PetStylizeLoadingScreen';
import PetStylizeResultScreen from '../screens/PetStylizeResultScreen';
import PlantStoreScreen from '../screens/PlantStoreScreen';
import CheckInScreen from '../../src/screens/CheckInScreen';
import HabitsTodayScreen from '../../src/screens/HabitsTodayScreen';
import DailyTasksScreen from '../../src/screens/DailyTasksScreen';
import JournalScreen from '../../src/screens/JournalScreen';
import PetSetupScreen from '../../src/screens/PetSetupScreen.tsx';
import OnboardingScreen from '../../src/screens/onboarding/OnboardingScreen';
import PlayScreen from '../../src/screens/PlayScreen';
import WardrobeScreen from '../../src/screens/WardrobeScreen';
import CycleScreen from '../../src/screens/CycleScreen';
import MemorialScreen from '../../src/screens/MemorialScreen';
import FetchGameScreen from '../../src/games/fetch/FetchGameScreen';
import BubblesGameScreen from '../../src/games/bubbles/BubblesGameScreen';
import WeeklyReflectionScreen from '../../src/screens/WeeklyReflectionScreen';
import RemindersScreen from '../../src/screens/RemindersScreen';
import PetTalkScreen from '../../src/screens/PetTalkScreen';
import BreathingScreen from '../../src/screens/BreathingScreen';
import GardenScreen from '../screens/GardenScreen';
import NetworkDebugScreen from '../../src/screens/NetworkDebugScreen';
import DiagnosticsScreen from '../../src/screens/DiagnosticsScreen';
import {
  finchTabBarItemStyle,
  finchTabBarLabelStyle,
  renderFinchTabIcon,
  tabBarThemeFor,
} from '../../src/components/finchHome/FinchTabBarStyles';
import PetTabIcon from '../../src/components/pet/PetTabIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/theme';
import { fonts } from '../../src/theme/tokens';
import { TABS, isTabRoute } from './tabs';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Today · Garden · Play · Wardrobe · You. The order, labels and icons live in ./tabs.js; this maps them to screens.
const TAB_SCREENS = {
  Home: HomeScreen,
  Garden: GardenScreen,
  Play: PlayScreen,
  Wardrobe: WardrobeScreen,
  Pet: PetScreen,
};

function MainTabs({ route: tabsRoute }) {
  const { surface } = useTheme();
  const bar = tabBarThemeFor(surface);
  const initialTab = isTabRoute(tabsRoute?.params?.tab) ? tabsRoute.params.tab : "Home";
  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      tabBar={(props) => (
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: bar.style.backgroundColor }}>
          <BottomTabBar {...props} />
        </SafeAreaView>
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: surface.canvas },
        tabBarStyle: bar.style,
        tabBarLabelStyle: finchTabBarLabelStyle,
        tabBarItemStyle: finchTabBarItemStyle,
        tabBarActiveTintColor: bar.active,
        tabBarInactiveTintColor: bar.inactive,
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={TAB_SCREENS[tab.name]}
          options={{
            // `title` is the tab label and the accessibility name ("You, tab, 5 of 5")
            title: tab.label,
            tabBarIcon: ({ focused }) => (tab.petFace ? <PetTabIcon focused={focused} /> : renderFinchTabIcon(tab.icon, focused, surface)),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

/**
 * Native-stack headers on the paper of the hour: canvas background, no hairline, the title in Fraunces and a
 * bare back chevron.
 */
export function stackScreenOptions(surface) {
  return {
    headerShown: false,
    headerStyle: { backgroundColor: surface.canvas },
    headerTintColor: surface.text,
    headerTitleStyle: { fontFamily: fonts.display, fontSize: 19, color: surface.text },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: surface.canvas },
  };
}

/** `initialRoute` is for the dev design previews only: it opens a stack screen or a tab directly. */
export default function AppNavigator({ initialRoute = null }) {
  const { surface } = useTheme();
  const opensTab = !initialRoute || isTabRoute(initialRoute);
  return (
    <Stack.Navigator initialRouteName={opensTab ? "MainTabs" : initialRoute} screenOptions={stackScreenOptions(surface)}>
      <Stack.Screen name="MainTabs" component={MainTabs} initialParams={opensTab && initialRoute ? { tab: initialRoute } : undefined} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ title: "Daily Check-In", headerShown: true }} />
      <Stack.Screen name="Habits" component={HabitsTodayScreen} options={{ title: "Habits Today", headerShown: true }} />
      <Stack.Screen name="GardenProgress" component={GardenProgressScreen} options={{ title: "Garden Progress", headerShown: true }} />
      <Stack.Screen name="Tasks" component={DailyTasksScreen} options={{ title: "Daily Tasks", headerShown: true }} />
      <Stack.Screen name="Journal" component={JournalScreen} options={{ title: "Journal", headerShown: true }} />
      <Stack.Screen name="Breathing" component={BreathingScreen} options={{ title: "Breathe", headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="WeeklyReflection" component={WeeklyReflectionScreen} options={{ title: "Our week", headerShown: true }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} initialParams={{ mode: "replace" }} />
      <Stack.Screen name="PetSetup" component={PetSetupScreen} options={{ title: "Pet Setup", headerShown: true }} />
      <Stack.Screen name="PetStylizeLoading" component={PetStylizeLoadingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PetStylizeResult" component={PetStylizeResultScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Cycle" component={CycleScreen} options={{ title: "Cycle", headerShown: true }} />
      <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: "Reminders", headerShown: true }} />
      {/* settings and account, opened from the You tab (it was the Profile tab until 2026-10-15) */}
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Settings", headerShown: true }} />
      <Stack.Screen name="PetTalk" component={PetTalkScreen} options={{ title: "Talk", headerShown: true }} />
      <Stack.Screen name="Memorial" component={MemorialScreen} options={{ title: "Remembering", headerShown: true }} />
      <Stack.Screen name="PlayFetch" component={FetchGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlayBubbles" component={BubblesGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlantStore" component={PlantStoreScreen} options={{ title: "Plant Store", headerShown: true }} />
      <Stack.Screen name="NetworkDebug" component={NetworkDebugScreen} options={{ title: "Network Debug", headerShown: true }} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: "Diagnostics", headerShown: true }} />
    </Stack.Navigator>
  );
}
