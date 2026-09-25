import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { AppProvider } from './src/state/AppProvider';
import { initLocalDatabase } from './src/storage/localDatabase';

export default function App() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="liftiq.db" onInit={initLocalDatabase}>
        <AppProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AppProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
