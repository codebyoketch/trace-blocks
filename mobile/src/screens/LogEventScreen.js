import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { apiLogEvent } from '../services/api';
import StatusPicker from '../components/StatusPicker';

export default function LogEventScreen({ navigation, route }) {
  const { qrToken, product, lastEvent, statusChoices } = route.params;

  const [status,   setStatus]   = useState('');
  const [location, setLocation] = useState('');
  const [notes,    setNotes]    = useState('');
  const [gps,      setGps]      = useState(null);
  const [gpsMsg,   setGpsMsg]   = useState('Acquiring GPS…');
  const [gpsOk,    setGpsOk]    = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Capture GPS as soon as the screen mounts
  useEffect(() => {
    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        setGpsMsg('Location permission denied — event will be logged without GPS.');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 8000,
        });
        setGps({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setGpsOk(true);
        setGpsMsg(
          `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}  ` +
          `(±${Math.round(loc.coords.accuracy)} m)`
        );
      } catch {
        setGpsMsg('Could not get GPS — event will be logged without coordinates.');
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!status) {
      Alert.alert('Required', 'Please select a status.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Required', 'Please enter a location label.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiLogEvent(
        product.sku,
        status,
        location.trim(),
        gps?.latitude  ?? null,
        gps?.longitude ?? null,
        notes.trim(),
      );

      const txId = res.data.tx_id;
      Alert.alert(
        'Event Recorded ✓',
        `Status: ${status.replace('_', ' ')}\n\nTX: ${txId.startsWith('mock') ? txId : txId.slice(0, 24) + '…'}`,
        [{ text: 'Done', onPress: () => navigation.navigate('Main') }],
      );
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to record event. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Log Event</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Product card */}
      <View style={styles.productCard}>
        <Text style={styles.productLabel}>Product</Text>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productSku}>{product.sku}</Text>
        {lastEvent && (
          <View style={styles.lastEventRow}>
            <Text style={styles.lastEventLabel}>Last event:</Text>
            <Text style={styles.lastEventVal}>
              {lastEvent.status.replace('_', ' ')} · {lastEvent.location}
            </Text>
          </View>
        )}
      </View>

      {/* GPS strip */}
      <View style={[styles.gpsStrip, gpsOk && styles.gpsStripOk]}>
        <Text style={styles.gpsDot}>{gpsOk ? '●' : '○'}</Text>
        <Text style={[styles.gpsText, gpsOk && styles.gpsTextOk]}>{gpsMsg}</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.sectionLabel}>Status</Text>
        <StatusPicker value={status} onChange={setStatus} />

        <Text style={styles.sectionLabel}>Location label</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Kisumu Hub Gate 3"
          placeholderTextColor="#A8A49A"
        />

        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any relevant notes…"
          placeholderTextColor="#A8A49A"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>⬡  Record on VeChain</Text>
        }
      </TouchableOpacity>

      <Text style={styles.footer}>Event will be written to VeChain Testnet</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EE' },
  inner:     { paddingBottom: 48 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn:     {},
  backBtnText: { color: 'rgba(208,235,224,0.7)', fontSize: 14 },
  topTitle:    { color: '#E8F4EE', fontSize: 16, fontWeight: '600' },

  productCard: {
    backgroundColor: '#FFFFFF', margin: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#E2DED6', padding: 16,
  },
  productLabel: { fontSize: 10, fontWeight: '700', color: '#7A7669', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  productName:  { fontSize: 17, fontWeight: '600', color: '#1C1A17', marginBottom: 2 },
  productSku:   { fontSize: 12, color: '#7A7669', fontFamily: 'monospace' },
  lastEventRow: { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F3EE' },
  lastEventLabel: { fontSize: 12, color: '#A8A49A' },
  lastEventVal:   { fontSize: 12, color: '#7A7669', flex: 1 },

  gpsStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  gpsStripOk: { backgroundColor: '#E8F4EE', borderColor: '#B5D9C8' },
  gpsDot:     { fontSize: 10, color: '#A8A49A' },
  gpsText:    { fontSize: 12, color: '#7A7669', flex: 1, fontFamily: 'monospace' },
  gpsTextOk:  { color: '#2D6A4F' },

  form: { paddingHorizontal: 16, gap: 4 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#7A7669',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 14, marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCC9BF',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#1C1A17',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  submitBtn: {
    margin: 16, backgroundColor: '#2D6A4F',
    borderRadius: 12, paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  footer: { textAlign: 'center', color: '#A8A49A', fontSize: 11, marginBottom: 8 },
});