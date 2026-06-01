import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import {
  apiGetProfile, apiUpdateProfile,
  apiChangePassword, apiLogoutAll,
} from '../services/api';
import { clearSession, saveUser } from '../services/auth';

export default function AccountScreen({ navigation }) {
  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw,    setSavingPw]    = useState(false);

  // Profile fields
  const [firstName,  setFirstName]  = useState('');
  const [secondName, setSecondName] = useState('');
  const [phone,      setPhone]      = useState('');

  // Password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  useEffect(() => {
    apiGetProfile()
      .then((res) => {
        const p = res.data;
        setProfile(p);
        setFirstName(p.first_name  || '');
        setSecondName(p.second_name || '');
        setPhone(p.phonenumber     || '');
      })
      .catch(() => Alert.alert('Error', 'Could not load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await apiUpdateProfile({
        first_name:  firstName.trim(),
        second_name: secondName.trim(),
        phonenumber: phone.trim(),
      });
      await saveUser({ username: res.data.username, email: res.data.email });
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert('Required', 'All password fields are required.');
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPw.length < 6) {
      Alert.alert('Too Short', 'New password must be at least 6 characters.');
      return;
    }

    setSavingPw(true);
    try {
      await apiChangePassword(currentPw, newPw);
      await clearSession();
      Alert.alert(
        'Password Changed',
        'Your password has been updated. Please log in again.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }],
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Logout All Devices',
      'This will sign you out of all devices including this one. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All', style: 'destructive',
          onPress: async () => {
            try {
              await apiLogoutAll();
              await clearSession();
              navigation.replace('Login');
            } catch {
              // Still clear local session even if API call fails
              await clearSession();
              navigation.replace('Login');
            }
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    await clearSession();
    navigation.replace('Login');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Account</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Avatar + username */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.username?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.username}>{profile?.username}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        {profile?.user_type && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{profile.user_type}</Text>
          </View>
        )}
      </View>

      {/* Profile info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>

        <Text style={styles.label}>First Name</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
          placeholder="First name" placeholderTextColor="#A8A49A" />

        <Text style={styles.label}>Last Name</Text>
        <TextInput style={styles.input} value={secondName} onChangeText={setSecondName}
          placeholder="Last name" placeholderTextColor="#A8A49A" />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone}
          placeholder="+254 7XX XXX XXX" placeholderTextColor="#A8A49A"
          keyboardType="phone-pad" />

        <TouchableOpacity
          style={[styles.btn, savingProfile && styles.btnDisabled]}
          onPress={handleSaveProfile} disabled={savingProfile}
        >
          {savingProfile
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>Save Profile</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Change password */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <Text style={styles.label}>Current Password</Text>
        <TextInput style={styles.input} value={currentPw} onChangeText={setCurrentPw}
          placeholder="••••••••" placeholderTextColor="#A8A49A" secureTextEntry />

        <Text style={styles.label}>New Password</Text>
        <TextInput style={styles.input} value={newPw} onChangeText={setNewPw}
          placeholder="••••••••" placeholderTextColor="#A8A49A" secureTextEntry />

        <Text style={styles.label}>Confirm New Password</Text>
        <TextInput style={styles.input} value={confirmPw} onChangeText={setConfirmPw}
          placeholder="••••••••" placeholderTextColor="#A8A49A" secureTextEntry />

        <TouchableOpacity
          style={[styles.btn, savingPw && styles.btnDisabled]}
          onPress={handleChangePassword} disabled={savingPw}
        >
          {savingPw
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>Change Password</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Session management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sessions</Text>

        <TouchableOpacity style={styles.outlineBtn} onPress={handleLogout}>
          <Text style={styles.outlineBtnText}>Sign Out (This Device)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.outlineBtn, styles.dangerBtn]} onPress={handleLogoutAll}>
          <Text style={[styles.outlineBtnText, styles.dangerText]}>
            Logout All Devices
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>TraceBlocks · VeChain Testnet</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EE' },
  inner:     { paddingBottom: 48 },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3EE' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
  },
  backText: { color: 'rgba(208,235,224,0.7)', fontSize: 14 },
  topTitle: { color: '#E8F4EE', fontSize: 16, fontWeight: '600' },

  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#1A2E22' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#2D6A4F', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(111,196,154,0.3)', marginBottom: 10,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '300' },
  username:   { color: '#E8F4EE', fontSize: 18, fontWeight: '600', marginBottom: 3 },
  email:      { color: 'rgba(111,196,154,0.6)', fontSize: 13 },
  typeBadge:  { marginTop: 8, backgroundColor: 'rgba(45,106,79,0.3)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  typeText:   { color: '#6FC49A', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  section: {
    backgroundColor: '#FFFFFF', margin: 16, marginBottom: 0,
    borderRadius: 14, borderWidth: 1, borderColor: '#E2DED6', padding: 16,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#1C1A17',
    marginBottom: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#F5F3EE',
  },
  label: {
    fontSize: 10, fontWeight: '700', color: '#7A7669',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#CCC9BF',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#1C1A17',
  },

  btn: {
    backgroundColor: '#2D6A4F', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },

  outlineBtn: {
    borderWidth: 1, borderColor: '#CCC9BF', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 10,
  },
  outlineBtnText: { fontSize: 14, color: '#7A7669', fontWeight: '600' },
  dangerBtn:      { borderColor: '#F0BFBF', marginTop: 8 },
  dangerText:     { color: '#A32D2D' },

  footer: { textAlign: 'center', color: '#A8A49A', fontSize: 11, marginTop: 24 },
});