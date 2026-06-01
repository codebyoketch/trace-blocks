import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { apiResolveQR } from '../services/api';

export default function ScanScreen({ navigation, route }) {
  const { sku, name } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,  setScanned]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const cooldown = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }) => {
    // Debounce — ignore rapid re-scans
    if (cooldown.current || scanned) return;
    cooldown.current = true;
    setScanned(true);
    setLoading(true);

    try {
      // The QR encodes either:
      //   a) a full URL: https://domain.com/api/mobile/qr/<token>/
      //   b) just the raw token: 2fb2c0b79b1646efbfc59387dd81e3fb
      let token = data.trim();

      // Extract token from URL if it's a full URL
      const match = token.match(/\/api\/mobile\/qr\/([a-f0-9]+)\/?/);
      if (match) {
        token = match[1];
      }

      const res = await apiResolveQR(token);
      const context = res.data;

      // Navigate to LogEvent with the resolved context
      navigation.navigate('LogEvent', {
        qrToken:  token,
        product:  context.product,
        lastEvent: context.last_event,
        statusChoices: context.status_choices,
      });
    } catch (err) {
      const msg = err.response?.status === 404
        ? 'QR code not recognised. Make sure you are scanning a TraceBlocks event QR.'
        : 'Could not reach server. Check your connection.';
      Alert.alert('Scan Failed', msg, [
        { text: 'Try Again', onPress: () => { setScanned(false); cooldown.current = false; } },
        { text: 'Cancel',    onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
      // Allow re-scan after 3 seconds
      setTimeout(() => { cooldown.current = false; }, 3000);
    }
  };

  // ── Permission not yet determined ──
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2D6A4F" size="large" />
      </View>
    );
  }

  // ── Permission denied ──
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permSub}>TraceBlocks needs camera access to scan QR codes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
  <View style={{ flex: 1 }}>
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
    />

    {/* Overlay sits on top of camera using absolute positioning */}
    <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
      {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan QR Code</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Context label */}
        {name && (
          <View style={styles.contextBadge}>
            <Text style={styles.contextText}>Scanning for: {name}</Text>
          </View>
        )}

        {/* Viewfinder */}
        <View style={styles.viewfinderWrap}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>

        {/* Bottom hint */}
        <View style={styles.bottomHint}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#E8F4EE" size="small" />
              <Text style={styles.hintText}>Resolving QR…</Text>
            </View>
          ) : (
            <Text style={styles.hintText}>
              {scanned ? 'QR scanned — loading…' : 'Point at a TraceBlocks event QR code'}
            </Text>
          )}
          {scanned && !loading && (
            <TouchableOpacity
              style={styles.rescanBtn}
              onPress={() => { setScanned(false); cooldown.current = false; }}
            >
              <Text style={styles.rescanText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3EE', padding: 32 },

  permTitle:   { fontSize: 18, fontWeight: '600', color: '#1C1A17', marginBottom: 8, textAlign: 'center' },
  permSub:     { fontSize: 14, color: '#7A7669', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  permBtn:     { backgroundColor: '#2D6A4F', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 16 },
  permBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  backLink:    { color: '#7A7669', fontSize: 14, marginTop: 8 },

  overlay: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#fff', fontSize: 18, fontWeight: '300' },
  topTitle:    { color: '#fff', fontSize: 16, fontWeight: '600' },

  contextBadge: {
    alignSelf: 'center', marginTop: 8,
    backgroundColor: 'rgba(45,106,79,0.7)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  contextText: { color: '#E8F4EE', fontSize: 12, fontWeight: '500' },

  viewfinderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinder: {
    width: 240, height: 240,
    position: 'relative',
  },

  // Corner brackets
  corner: {
    position: 'absolute', width: 32, height: 32,
    borderColor: '#E8F4EE', borderWidth: 3,
  },
  tl: { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  tr: { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 4 },
  bl: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 4 },

  bottomHint: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24, alignItems: 'center', gap: 12,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintText:   { color: '#E8F4EE', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  rescanBtn:  { backgroundColor: 'rgba(45,106,79,0.8)', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  rescanText: { color: '#E8F4EE', fontSize: 13, fontWeight: '600' },
});