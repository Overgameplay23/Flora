import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { supabase } from '../../src/lib/supabase';

function getAuthErrorDetails(error) {
  const status = typeof error?.status === 'number' ? error.status : undefined;
  const message = String(error?.message || '').toLowerCase();
  const nonJsonResponse = Boolean(error?.isNonJsonResponse) || message.includes('non-json error response');
  const serviceUnavailable =
    nonJsonResponse || status === 521 || status === 502 || status === 503 || status === 504;
  const missingEmailOrPhone = status === 400 && message.includes('missing email or phone');

  return { serviceUnavailable, missingEmailOrPhone };
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [emailHasError, setEmailHasError] = useState(false);

  const handleEmailChange = (nextEmail) => {
    setEmail(nextEmail);
    if (emailHasError) {
      setEmailHasError(false);
    }
  };

  const handleLogin = async () => {
    setError(null);
    setEmailHasError(false);

    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    const normalizedPassword = typeof password === 'string' ? password : '';

    console.log('AUTH_INPUT', {
      email: normalizedEmail,
      emailType: typeof normalizedEmail,
      passwordLen: normalizedPassword?.length,
    });

    if (!normalizedEmail) {
      setEmailHasError(true);
      setError('Please enter your email.');
      return;
    }

    if (!normalizedPassword) {
      setError('Please enter your password.');
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      if (error) throw error;
      navigation.replace('MainApp');
    } catch (err) {
      const { serviceUnavailable, missingEmailOrPhone } = getAuthErrorDetails(err);
      if (serviceUnavailable) {
        setError('Auth service temporarily unavailable. Try again.');
      } else if (missingEmailOrPhone) {
        setEmailHasError(true);
        setError('Please enter a valid email.');
      } else {
        setError(err?.message || 'Unable to sign in. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={[styles.input, emailHasError && styles.inputError]}
        placeholder="Email"
        value={email}
        onChangeText={handleEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Log In" onPress={handleLogin} />
      <Button
        title="Don't have an account? Sign Up"
        onPress={() => navigation.navigate('Signup')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 12, borderRadius: 4 },
  inputError: { borderColor: 'red' },
  error: { color: 'red', marginBottom: 12, textAlign: 'center' },
});
