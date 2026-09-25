import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { MetricPill } from '@/components/MetricPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenShell } from '@/components/ScreenShell';
import { StatRow } from '@/components/StatRow';
import { sendMagicLink, signInWithApple } from '@/services/auth';
import { useApp } from '@/state/AppProvider';
import { spacing } from '@/theme/metrics';
import { palette } from '@/theme/palette';

export function ProfileScreen() {
  const { state, pendingMutationCount, actions } = useApp();
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  return (
    <ScreenShell eyebrow="Profile" title="Keep the defaults honest." subtitle="This is where import interest, auth setup, and local sync health live for the MVP.">
      <Card title="Training profile" subtitle="Collected in onboarding and editable later.">
        <StatRow label="Goal" value={state.profile?.goalPhase ?? 'Not set'} />
        <StatRow label="Experience" value={state.profile?.trainingAge ?? 'Not set'} />
        <StatRow label="Split" value={state.profile?.trainingSplit ?? 'Not set'} />
        <StatRow label="Units" value={state.profile?.unitSystem ?? 'lb'} />
      </Card>

      <Card title="Import waitlist" subtitle="Imports are explicitly deferred, but we still capture demand now.">
        <View style={styles.metricRow}>
          <MetricPill label="Interested" value={state.profile?.importInterest ? 'Yes' : 'No'} tone={state.profile?.importInterest ? 'success' : 'default'} />
          <MetricPill label="Pending sync" value={String(pendingMutationCount)} tone={pendingMutationCount ? 'warning' : 'default'} />
        </View>
        <PrimaryButton label={state.profile?.importInterest ? 'Remove me from import waitlist' : 'Join import waitlist'} onPress={() => actions.toggleImportInterest()} />
      </Card>

      <Card title="Auth scaffold" subtitle="Apple sign-in is preferred. Email magic link remains the fallback.">
        <PrimaryButton
          label="Sign in with Apple"
          onPress={async () => {
            const result = await signInWithApple();
            setAuthMessage(result.ok ? 'Apple sign-in scaffold succeeded.' : result.message);
            if (result.ok) {
              await actions.setAuthMode('apple');
            }
          }}
        />
        <TextInput value={email} onChangeText={setEmail} placeholder="Email for magic link" placeholderTextColor={palette.muted} style={styles.input} autoCapitalize="none" keyboardType="email-address" />
        <PrimaryButton
          label="Send magic link"
          variant="ghost"
          onPress={async () => {
            const result = await sendMagicLink(email);
            setAuthMessage(result.ok ? 'Magic link request sent.' : result.message);
            if (result.ok) {
              await actions.setAuthMode('magic-link');
            }
          }}
        />
        {authMessage ? <Text style={styles.authMessage}>{authMessage}</Text> : null}
      </Card>

      <Card title="What syncs later" subtitle="The app is local-first right now and queues writes for backend handoff.">
        <Text style={styles.copy}>Profile edits, completed sessions, and logged sets are queued locally already. Once Supabase env vars are present, the same client can start draining those mutations into the server schema without reshaping the UI layer.</Text>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: palette.ink,
    fontSize: 15,
  },
  authMessage: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  copy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
