import "./global.css";
import React from 'react';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './app/navigation/RootNavigator';
import { runStartupNetworkDiagnostics } from "./src/utils/net";

// Kick off connectivity probes before the app renders; failures are logged but won't block startup.
void runStartupNetworkDiagnostics();

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
