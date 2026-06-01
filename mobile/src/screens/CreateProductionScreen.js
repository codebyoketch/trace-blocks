import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { apiCreateProduct } from '../services/api';

export default function CreateProductScreen({ navigation }) {
  const [name,         setName]         = useState('');
  const [sku,          setSku]          = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [description,  setDescription]  = useState('');
  const [location,     setLocation]     = useState('');
  const [gps,          setGps]          = useState(null);
  const [gpsMsg,       setGpsMsg]       = useState('Acquiring GPS…');
  const [gpsOk,        setGpsOk]        = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsMsg('Location permission denied.');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setGps({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setGpsOk(true);
        setGpsMsg(
          `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)} ` +
          `(±${Math.round(loc.coords.accuracy)} m)`
        );
      } catch {
        setGpsMsg('GPS unavailable — product will be created without coordinates.');
      }
    })();
  }, []);

  // Auto-generate a SKU suggestion from the name
  const handleNameChange = (val) => {
    setName(val);
    if (!sku) {
      const generated = val.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 12);
      if (generated) setSku(`${generated}-001`);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Product name is required.'); return; }
    if (!sku.trim())  { Alert.alert('Required', 'SKU is required.'); return; }
    if (!location.trim()) { Alert.alert('Required', 'Manufacturing location is required.'); return; }

    setSubmitting(true);
    try {
      const res = await apiCreateProduct({
        name:         name.trim(),
        sku:          sku.trim(),
        manufacturer: manufacturer.trim(),
        description:  description.trim(),
        location:     location.trim(),
        latitude:     gps?.latitude  ?? null,
        longitude:    gps?.longitude ?? null,
      });

      Alert.alert(
        'Product Created ✓',
        `${name}\nSKU: ${sku}\n\nTX: ${res.data.tx_id?.slice(0, 24)}…`,
        [{ text: 'Done', onPress: () => navigation.navigate('Home') }],
      );
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create product.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>New Product</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* GPS strip */}
      <View style={[styles.gpsStrip, gpsOk && styles.gpsStripOk]}>
        <Text style={styles.gpsDot}>{gpsOk ? '●' : '○'}</Text>
        <Text style={[styles.gpsText, gpsOk && styles.gpsTextOk]}>{gpsMsg}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Product Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={handleNameChange}
          placeholder="e.g. Fish Consignment"
          placeholderTextColor="#A8A49A"
        />

        <Text style={styles.label}>SKU *</Text>
        <TextInput
          style={styles.input}
          value={sku}
          onChangeText={setSku}
          placeholder="e.g. FISH-001"
          placeholderTextColor="#A8A49A"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Manufacturer</Text>
        <TextInput
          style={styles.input}
          value={manufacturer}
          onChangeText={setManufacturer}
          placeholder="e.g. Rouwel Farms"
          placeholderTextColor="#A8A49A"
        />

        <Text style={styles.label}>Manufacturing Location *</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. Kisumu Factory"
          placeholderTextColor="#A8A49A"
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description of the product…"
          placeholderTextColor="#A8A49A"
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>⬡  Create & Record on VeChain</Text>
        }
      </TouchableOpacity>

      <Text style={styles.footer}>A 'Manufactured' event will be logged automatically</Text>
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
  backText: { color: 'rgba(208,235,224,0.7)', fontSize: 14 },
  topTitle: { color: '#E8F4EE', fontSize: 16, fontWeight: '600' },

  gpsStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, marginBottom: 8,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  gpsStripOk: { backgroundColor: '#E8F4EE', borderColor: '#B5D9C8' },
  gpsDot:     { fontSize: 10, color: '#A8A49A' },
  gpsText:    { fontSize: 12, color: '#7A7669', flex: 1, fontFamily: 'monospace' },
  gpsTextOk:  { color: '#2D6A4F' },

  form:  { paddingHorizontal: 16, gap: 4 },
  label: {
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
    borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { textAlign: 'center', color: '#A8A49A', fontSize: 11 },
});