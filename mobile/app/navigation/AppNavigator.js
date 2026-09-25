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
import FetchGameScreen from '../../src/games/fetch/FetchGameScreen';
import BubblesGameScreen from '../../src/games/bubbles/BubblesGameScreen';
import WeeklyReflectionScreen from '../../src/screens/WeeklyReflectionScreen';
import BreathingScreen from '../../src/screens/BreathingScreen';
import GardenScreen from '../screens/GardenScreen';
import NetworkDebugScreen from '../../src/screens/NetworkDebugScreen';
import DiagnosticsScreen from '../../src/screens/DiagnosticsScreen';
import PetChatScreen from '../../src/screens/PetChatScreen';
import { finchTabBarItemStyle, finchTabBarLabelStyle, finchTabBarStyle, renderFinchTabIcon } from '../../src/components/finchHome/FinchTabBarStyles';
import PetTabIcon from '../../src/components/pet/PetTabIcon';
import { SafeAreaView } from 'react-native-safe-area-context';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => (
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: finchTabBarStyle.backgroundColor }}>
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
          tabBarStyle: finchTabBarStyle,
          tabBarLabelStyle: finchTabBarLabelStyle,
          tabBarItemStyle: finchTabBarItemStyle,
          tabBarActiveTintColor: "#35d07f",
          tabBarInactiveTintColor: "rgba(148,163,184,0.8)",
          tabBarIcon: ({ focused }) =>
            route.name === "Pet" ? <PetTabIcon focused={focused} /> : renderFinchTabIcon(iconName, focused),
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

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ title: "Daily Check-In", headerShown: true }} />
      <Stack.Screen name="Habits" component={HabitsTodayScreen} options={{ title: "Habits Today", headerShown: true }} />
      <Stack.Screen name="GardenProgress" component={GardenProgressScreen} options={{ title: "Garden Progress", headerShown: true }} />
      <Stack.Screen name="Tasks" component={DailyTasksScreen} options={{ title: "Daily Tasks", headerShown: true }} />
      <Stack.Screen name="Journal" component={JournalScreen} options={{ title: "Journal", headerShown: true }} />
      <Stack.Screen name="Breathing" component={BreathingScreen} options={{ title: "1-minute breathing", headerShown: true, presentation: "modal" }} />
      <Stack.Screen name="WeeklyReflection" component={WeeklyReflectionScreen} options={{ title: "Weekly Reflection", headerShown: true }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} initialParams={{ mode: "replace" }} />
      <Stack.Screen name="PetSetup" component={PetSetupScreen} options={{ title: "Pet Setup", headerShown: true }} />
      <Stack.Screen name="PetStylizeLoading" component={PetStylizeLoadingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PetStylizeResult" component={PetStylizeResultScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PetChat" component={PetChatScreen} options={{ title: "Talk to your pet", headerShown: true }} />
      <Stack.Screen name="Play" component={PlayScreen} options={{ title: "Play", headerShown: true }} />
      <Stack.Screen name="Cycle" component={CycleScreen} options={{ title: "Cycle", headerShown: true }} />
      <Stack.Screen name="PlayFetch" component={FetchGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlayBubbles" component={BubblesGameScreen} options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="PlantStore" component={PlantStoreScreen} options={{ title: "Plant Store", headerShown: true }} />
      <Stack.Screen name="NetworkDebug" component={NetworkDebugScreen} options={{ title: "Network Debug", headerShown: true }} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: "Diagnostics", headerShown: true }} />
    </Stack.Navigator>
  );
}
