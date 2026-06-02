import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Modal, FlatList,
} from 'react-native';
import * as Location from 'expo-location';
import { apiGetProducts, apiLogEvent, apiLogHandover } from '../services/api';
import StatusPicker from '../components/StatusPicker';

const UNITS = ['kg', 'Tonnes', 'Litres', 'Units', 'Boxes', 'Bags', 'Pallets'];
const MODES = ['road', 'rail', 'air', 'sea', 'motorcycle'];

export default function ManualLogScreen({ navigation, route }) {
  const preselected = route?.params?.product ?? null;

  const [mode,       setMode]       = useState('event');
  const [products,   setProducts]   = useState([]);
  const [product,    setProduct]    = useState(preselected);
  const [showPicker, setShowPicker] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // GPS
  const [gps,    setGps]    = useState(null);
  const [gpsMsg, setGpsMsg] = useState('Acquiring GPS…');
  const [gpsOk,  setGpsOk]  = useState(false);

  // Quick event fields
  const [status,   setStatus]   = useState('');
  const [location, setLocation] = useState('');
  const [notes,    setNotes]    = useState('');

  // Handover fields
  const [handoverLocation, setHandoverLocation] = useState('');
  const [handoverDatetime, setHandoverDatetime] = useState('');
  const [qtyDispatched,    setQtyDispatched]    = useState('');
  const [qtyReceived,      setQtyReceived]      = useState('');
  const [unit,             setUnit]             = useState('');
  const [discrepancyNote,  setDiscrepancyNote]  = useState('');
  const [outgoingName,     setOutgoingName]     = useState('');
  const [outgoingRole,     setOutgoingRole]     = useState('');
  const [outgoingSig,      setOutgoingSig]      = useState('');
  const [incomingName,     setIncomingName]     = useState('');
  const [incomingRole,     setIncomingRole]     = useState('');
  const [incomingSig,      setIncomingSig]      = useState('');
  const [carrier,          setCarrier]          = useState('');
  const [plate,            setPlate]            = useState('');
  const [transportMode,    setTransportMode]    = useState('');

  useEffect(() => {
    apiGetProducts()
      .then((res) => setProducts(res.data?.products ?? []))
      .catch(() => Alert.alert('Error', 'Could not load products.'))
      .finally(() => setLoading(false));

    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') { setGpsMsg('Location permission denied.'); return; }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setGps({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setGpsOk(true);
        setGpsMsg(
          `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}  ` +
          `(±${Math.round(loc.coords.accuracy)} m)`
        );
      } catch {
        setGpsMsg('GPS unavailable.');
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!product) { Alert.alert('Required', 'Please select a product.'); return; }
    setSubmitting(true);
    try {
      if (mode === 'event') {
        if (!status)          { Alert.alert('Required', 'Please select a status.');  setSubmitting(false); return; }
        if (!location.trim()) { Alert.alert('Required', 'Location is required.');     setSubmitting(false); return; }
        const res = await apiLogEvent(
          product.sku, status, location.trim(),
          gps?.latitude ?? null, gps?.longitude ?? null, notes.trim(),
        );
        Alert.alert(
          'Event Recorded ✓',
          `Status: ${status.replace(/_/g, ' ')}\nTX: ${res.data.tx_id?.slice(0, 24)}…`,
          [{ text: 'Done', onPress: () => navigation.navigate('Main') }],
        );
      } else {
        if (!handoverLocation.trim()) { Alert.alert('Required', 'Handover location is required.');        setSubmitting(false); return; }
        if (!outgoingName.trim())     { Alert.alert('Required', 'Outgoing transporter name is required.'); setSubmitting(false); return; }
        if (!incomingName.trim())     { Alert.alert('Required', 'Incoming transporter name is required.'); setSubmitting(false); return; }
        const res = await apiLogHandover({
          sku:                  product.sku,
          handover_location:    handoverLocation.trim(),
          handover_datetime:    handoverDatetime.trim(),
          qty_dispatched:       qtyDispatched,
          qty_received:         qtyReceived,
          unit_of_measure:      unit,
          qty_discrepancy_note: discrepancyNote.trim(),
          outgoing_transporter: outgoingName.trim(),
          outgoing_role:        outgoingRole.trim(),
          outgoing_signature:   outgoingSig.trim(),
          incoming_transporter: incomingName.trim(),
          incoming_role:        incomingRole.trim(),
          incoming_signature:   incomingSig.trim(),
          carrier_name:         carrier.trim(),
          vehicle_plate:        plate.trim(),
          transport_mode:       transportMode,
          latitude:             gps?.latitude  ?? null,
          longitude:            gps?.longitude ?? null,
        });
        Alert.alert(
          'Handover Recorded ✓',
          `TX: ${res.data.tx_id?.slice(0, 24)}…`,
          [{ text: 'Done', onPress: () => navigation.navigate('Main') }],
        );
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2D6A4F" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Log Event</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Product — locked card if pre-selected, picker if not */}
        <View style={styles.productSection}>
          <Text style={styles.productSectionLabel}>Product</Text>
          {preselected ? (
            <View style={styles.productLocked}>
              <View style={styles.productLockedLeft}>
                <Text style={styles.productLockedName}>{product.name}</Text>
                <Text style={styles.productLockedSku}>{product.sku}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={() => { setShowPicker(true); }}
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowPicker(true)}>
              <Text style={product ? styles.pickerValue : styles.pickerPlaceholder}>
                {product ? `${product.name} — ${product.sku}` : 'Select a product…'}
              </Text>
              <Text style={styles.arrow}>▾</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'event' && styles.modeBtnActive]}
            onPress={() => setMode('event')}
          >
            <Text style={[styles.modeBtnText, mode === 'event' && styles.modeBtnTextActive]}>
              Quick Event
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'handover' && styles.modeBtnActive]}
            onPress={() => setMode('handover')}
          >
            <Text style={[styles.modeBtnText, mode === 'handover' && styles.modeBtnTextActive]}>
              Handover
            </Text>
          </TouchableOpacity>
        </View>

        {/* GPS strip */}
        <View style={[styles.gpsStrip, gpsOk && styles.gpsStripOk]}>
          <Text style={styles.gpsDot}>{gpsOk ? '●' : '○'}</Text>
          <Text style={[styles.gpsText, gpsOk && styles.gpsTextOk]} numberOfLines={1}>{gpsMsg}</Text>
        </View>

        <View style={styles.form}>
          {mode === 'event' ? (
            <>
              <Text style={styles.label}>Status *</Text>
              <StatusPicker value={status} onChange={setStatus} />

              <Text style={styles.label}>Location *</Text>
              <TextInput style={styles.input} value={location} onChangeText={setLocation}
                placeholder="e.g. Kisumu Hub" placeholderTextColor="#A8A49A" />

              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes}
                placeholder="Any relevant notes…" placeholderTextColor="#A8A49A"
                multiline numberOfLines={3} />
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Handover Details</Text>

              <Text style={styles.label}>Handover Location *</Text>
              <TextInput style={styles.input} value={handoverLocation} onChangeText={setHandoverLocation}
                placeholder="e.g. Kisumu Hub Gate 3" placeholderTextColor="#A8A49A" />

              <Text style={styles.label}>Date & Time</Text>
              <TextInput style={styles.input} value={handoverDatetime} onChangeText={setHandoverDatetime}
                placeholder="e.g. 2026-06-01 08:00" placeholderTextColor="#A8A49A" />

              <Text style={styles.sectionLabel}>Quantities</Text>
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Dispatched</Text>
                  <TextInput style={styles.input} value={qtyDispatched} onChangeText={setQtyDispatched}
                    placeholder="0" placeholderTextColor="#A8A49A" keyboardType="numeric" />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.label}>Received</Text>
                  <TextInput
                    style={[
                      styles.input,
                      qtyDispatched && qtyReceived &&
                      parseFloat(qtyDispatched) !== parseFloat(qtyReceived) && styles.inputWarn,
                    ]}
                    value={qtyReceived} onChangeText={setQtyReceived}
                    placeholder="0" placeholderTextColor="#A8A49A" keyboardType="numeric" />
                </View>
              </View>

              <Text style={styles.label}>Unit</Text>
              <View style={styles.chipRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity key={u}
                    style={[styles.chip, unit === u && styles.chipActive]}
                    onPress={() => setUnit(u)}>
                    <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Discrepancy Note</Text>
              <TextInput style={[styles.input, styles.textarea]} value={discrepancyNote}
                onChangeText={setDiscrepancyNote} placeholder="Explain any difference…"
                placeholderTextColor="#A8A49A" multiline numberOfLines={2} />

              <Text style={styles.sectionLabel}>Outgoing Transporter</Text>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} value={outgoingName} onChangeText={setOutgoingName}
                placeholder="Name of person releasing goods" placeholderTextColor="#A8A49A" />
              <Text style={styles.label}>Role</Text>
              <TextInput style={styles.input} value={outgoingRole} onChangeText={setOutgoingRole}
                placeholder="e.g. Driver" placeholderTextColor="#A8A49A" />
              <Text style={styles.label}>Signature (type full name)</Text>
              <TextInput style={[styles.input, styles.sigInput]} value={outgoingSig} onChangeText={setOutgoingSig}
                placeholder="Type full name to sign" placeholderTextColor="#A8A49A" />

              <Text style={styles.sectionLabel}>Incoming Transporter</Text>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} value={incomingName} onChangeText={setIncomingName}
                placeholder="Name of person receiving goods" placeholderTextColor="#A8A49A" />
              <Text style={styles.label}>Role</Text>
              <TextInput style={styles.input} value={incomingRole} onChangeText={setIncomingRole}
                placeholder="e.g. Warehouse Manager" placeholderTextColor="#A8A49A" />
              <Text style={styles.label}>Signature (type full name)</Text>
              <TextInput style={[styles.input, styles.sigInput]} value={incomingSig} onChangeText={setIncomingSig}
                placeholder="Type full name to sign" placeholderTextColor="#A8A49A" />

              <Text style={styles.sectionLabel}>Transport (optional)</Text>
              <Text style={styles.label}>Carrier</Text>
              <TextInput style={styles.input} value={carrier} onChangeText={setCarrier}
                placeholder="e.g. Siginon Logistics" placeholderTextColor="#A8A49A" />
              <Text style={styles.label}>Vehicle Plate</Text>
              <TextInput style={styles.input} value={plate} onChangeText={setPlate}
                placeholder="e.g. KDA 123B" placeholderTextColor="#A8A49A"
                autoCapitalize="characters" />
              <Text style={styles.label}>Mode</Text>
              <View style={styles.chipRow}>
                {MODES.map((m) => (
                  <TouchableOpacity key={m}
                    style={[styles.chip, transportMode === m && styles.chipActive]}
                    onPress={() => setTransportMode(m)}>
                    <Text style={[styles.chipText, transportMode === m && styles.chipTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit} disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>
                ⬡  {mode === 'event' ? 'Record on VeChain' : 'Record Handover on VeChain'}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.footer}>Events are logged immutably on VeChain Testnet</Text>
      </ScrollView>

      {/* Product picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Product</Text>
            <FlatList
              data={products}
              keyExtractor={(item) => item.sku}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.sheetOption, product?.sku === item.sku && styles.sheetOptionActive]}
                  onPress={() => { setProduct(item); setShowPicker(false); }}
                >
                  <View>
                    <Text style={styles.sheetOptionName}>{item.name}</Text>
                    <Text style={styles.sheetOptionSku}>{item.sku}</Text>
                  </View>
                  {product?.sku === item.sku && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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

  // Product section
  productSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  productSectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#7A7669',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  productLocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#E8F4EE', borderWidth: 1, borderColor: '#B5D9C8',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  productLockedLeft: { flex: 1 },
  productLockedName: { fontSize: 14, fontWeight: '600', color: '#1C1A17' },
  productLockedSku:  { fontSize: 11, color: '#2D6A4F', fontFamily: 'monospace', marginTop: 2 },
  changeBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: '#B5D9C8',
    marginLeft: 10,
  },
  changeBtnText: { fontSize: 11, color: '#2D6A4F', fontWeight: '600' },

  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCC9BF',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerValue:       { fontSize: 14, color: '#1C1A17', flex: 1 },
  pickerPlaceholder: { fontSize: 14, color: '#A8A49A', flex: 1 },
  arrow:             { fontSize: 14, color: '#7A7669' },

  // Mode toggle
  modeRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: '#FFFFFF', borderRadius: 10,
    borderWidth: 1, borderColor: '#E2DED6', overflow: 'hidden',
  },
  modeBtn:           { flex: 1, paddingVertical: 11, alignItems: 'center' },
  modeBtnActive:     { backgroundColor: '#2D6A4F' },
  modeBtnText:       { fontSize: 13, fontWeight: '600', color: '#7A7669' },
  modeBtnTextActive: { color: '#fff' },

  // GPS
  gpsStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  gpsStripOk: { backgroundColor: '#E8F4EE', borderColor: '#B5D9C8' },
  gpsDot:     { fontSize: 10, color: '#A8A49A' },
  gpsText:    { fontSize: 11, color: '#7A7669', flex: 1, fontFamily: 'monospace' },
  gpsTextOk:  { color: '#2D6A4F' },

  // Form
  form: { paddingHorizontal: 16 },
  label: {
    fontSize: 10, fontWeight: '700', color: '#7A7669',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14, marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#1C1A17',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 20, marginBottom: 4, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: '#E2DED6',
  },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCC9BF',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#1C1A17',
  },
  inputWarn: { borderColor: '#E0A060' },
  textarea:  { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 },
  sigInput:  { fontStyle: 'italic' },

  row:       { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#CCC9BF',
    backgroundColor: '#FFFFFF',
  },
  chipActive:     { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  chipText:       { fontSize: 12, color: '#7A7669', fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  submitBtn: {
    margin: 16, backgroundColor: '#2D6A4F',
    borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  footer: { textAlign: 'center', color: '#A8A49A', fontSize: 11, marginBottom: 8 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 36, maxHeight: '70%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2DED6',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 13, fontWeight: '700', color: '#7A7669',
    letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2DED6',
  },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F3EE',
  },
  sheetOptionActive: { backgroundColor: '#E8F4EE' },
  sheetOptionName:   { fontSize: 15, color: '#1C1A17', fontWeight: '500' },
  sheetOptionSku:    { fontSize: 11, color: '#7A7669', fontFamily: 'monospace', marginTop: 2 },
  check: { color: '#2D6A4F', fontWeight: '700', fontSize: 16 },
});