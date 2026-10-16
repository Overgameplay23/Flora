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
import CycleScreen from '../../src/screens/CycleScreen';
import MemorialScreen from '../../src/screens/MemorialScreen';
import FetchGameScreen from '../../src/games/fetch/FetchGameScreen';
import BubblesGameScreen from '../../src/games/bubbles/BubblesGameScreen';
import PettingGameScreen from '../../src/games/petting/PettingGameScreen';
import TreatsGameScreen from '../../src/games/treats/TreatsGameScreen';
import WeeklyReflectionScreen from '../../src/screens/WeeklyReflectionScreen';
import RemindersScreen from '../../src/screens/RemindersScreen';
import PetTalkScreen from '../../src/screens/PetTalkScreen';
import BreathingScreen from '../../src/screens/BreathingScreen';
import GardenScreen from '../screens/GardenScreen';
import NetworkDebugScreen from '../../src/screens/NetworkDebugScreen';
import DiagnosticsScreen from '../../src/screens/DiagnosticsScreen';
import JourneysScreen from '../../src/screens/JourneysScreen';
import JourneyScreen from '../../src/screens/JourneyScreen';
import KeepsakesScreen from '../../src/screens/KeepsakesScreen';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_NAMES = ["Home", "Garden", "Pet", "Profile"];

function MainTabs({ route: tabsRoute }) {
  const { surface } = useTheme();
  const bar = tabBarThemeFor(surface);
  const initialTab = TAB_NAMES.includes(tabsRoute?.params?.tab) ? tabsRoute.params.tab : "Home";
  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      tabBar={(props) => (
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: bar.style.backgroundColor }}>
          <BottomTabBar {...props} />
        </SafeAreaView>
      )}
      screenOptions={({ route }) => {
        const iconMap = {
          Home: "home",
          Garden: "feather",
          Pet: "heart",
          Profile: "user",
        };
        const iconName = iconMap[route.name] || "circle";
        return {
          headerShown: false,
          sceneStyle: { backgroundColor: surface.canvas },
          tabBarStyle: bar.style,
          tabBarLabelStyle: finchTabBarLabelStyle,
          tabBarItemStyle: finchTabBarItemStyle,
          tabBarActiveTintColor: bar.active,
          tabBarInactiveTintColor: bar.inactive,
          tabBarIcon: ({ focused }) =>
            route.name === "Pet" ? <PetTabIcon focused={focused} /> : renderFinchTabIcon(iconName, focused, surface),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Garden" component={GardenScreen} />
      <Tab.Screen name="Pet" component={PetScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
  const opensTab = !initialRoute || TAB_NAMES.includes(initialRoute);
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
      <Stack.Screen name="Play" component={PlayScreen} options={{ title: "Play", headerShown: true }} />
      <Stack.Screen name="Cycle" component={CycleScreen} options={{ title: "Cycle", headerShown: true }} />
      <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: "Reminders", headerShown: true }} />
      <Stack.Screen name="PetTalk" component={PetTalkScreen} options={{ title: "Talk", headerShown: true }} />
      <Stack.Screen name="Memorial" component={MemorialScreen} options={{ title: "Remembering", headerShown: true }} />
      <Stack.Screen name="PlayFetch" component={FetchGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlayBubbles" component={BubblesGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlayPetting" component={PettingGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlayTreats" component={TreatsGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlantStore" component={PlantStoreScreen} options={{ title: "Plant Store", headerShown: true }} />
      <Stack.Screen name="NetworkDebug" component={NetworkDebugScreen} options={{ title: "Network Debug", headerShown: true }} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: "Diagnostics", headerShown: true }} />
      <Stack.Screen name="Journeys" component={JourneysScreen} options={{ title: "Journeys", headerShown: true }} />
      <Stack.Screen name="Journey" component={JourneyScreen} options={{ title: "Journey", headerShown: true }} />
      <Stack.Screen name="Keepsakes" component={KeepsakesScreen} options={{ title: "Keepsakes", headerShown: true }} />
    </Stack.Navigator>
  );
}
