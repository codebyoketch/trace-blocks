import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { apiLogin } from '../services/api';
import { saveToken, saveUser } from '../services/auth';

export default function LoginScreen({ navigation }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiLogin(email.trim(), password);
      await saveToken(res.data.token);
      await saveUser({ username: res.data.username, email: res.data.email });
      navigation.replace('Home');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoMark}>
            <Text style={styles.logoIcon}>⬡</Text>
          </View>
          <Text style={styles.logoName}>TraceBlocks</Text>
        </View>

        <Text style={styles.subtitle}>Supply chain on VeChain</Text>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#A8A49A"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#A8A49A"
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>TraceBlocks · VeChain Testnet</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2E22' },
  inner: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 28, paddingBottom: 40,
  },

  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  logoMark: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { color: '#E8F4EE', fontSize: 20 },
  logoName: { color: '#E8F4EE', fontSize: 24, fontWeight: '300', letterSpacing: -0.5 },
  subtitle: { color: 'rgba(111,196,154,0.5)', fontSize: 13, marginBottom: 36, letterSpacing: 0.5 },

  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 20, gap: 4,
  },
  label: {
    fontSize: 11, fontWeight: '600', color: '#7A7669',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 10, marginBottom: 4,
  },
  input: {
    backgroundColor: '#F9F8F5',
    borderWidth: 1, borderColor: '#CCC9BF',
    borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 14, color: '#1C1A17',
  },
  btn: {
    backgroundColor: '#2D6A4F', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  footer: {
    color: 'rgba(111,196,154,0.3)', fontSize: 11,
    textAlign: 'center', marginTop: 28, letterSpacing: 0.5,
  },
});