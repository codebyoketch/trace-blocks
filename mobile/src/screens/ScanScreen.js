import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Platform,
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
    if (permission && !permission.granted) requestPermission();
  }, [permission]);

  const handleBarCodeScanned = async ({ data }) => {
    if (cooldown.current || scanned) return;
    cooldown.current = true;
    setScanned(true);
    setLoading(true);
    try {
      let token = data.trim();
      const match = token.match(/\/api\/mobile\/qr\/([a-f0-9]+)\/?/);
      if (match) token = match[1];
      const res     = await apiResolveQR(token);
      const context = res.data;
      navigation.navigate('LogEvent', {
        qrToken:       token,
        product:       context.product,
        lastEvent:     context.last_event,
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
      setTimeout(() => { cooldown.current = false; }, 3000);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2D6A4F" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permSub}>
          TraceBlocks needs camera access to scan QR codes.
        </Text>
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent={false} />

      {/*
        CameraView as a normal flex child — fills the entire container.
        The overlay sits on top via absoluteFillObject.
      */}
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/*
        Overlay: three sections stacked with flex.
        Top and bottom have solid/semi-transparent backgrounds.
        The MIDDLE section is fully transparent — camera shows through.
      */}
      <View style={styles.overlay} pointerEvents="box-none">

        {/* ── 1. Top dark band ────────────────────────────────────────── */}
        <View style={styles.topBand}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.topTitle}>Scan QR Code</Text>
            <View style={{ width: 36 }} />
          </View>
          {name ? (
            <View style={styles.contextWrap}>
              <View style={styles.contextBadge}>
                <Text style={styles.contextText}>Scanning for: {name}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── 2. Transparent middle — camera feed shows through ────────── */}
        <View style={styles.middle} pointerEvents="none">
          {/* just the four corner brackets */}
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>

        {/* ── 3. Bottom dark band ─────────────────────────────────────── */}
        <View style={styles.bottomBand}>
          <Text style={styles.frameHint}>
            {scanned ? '✓  QR detected — loading…' : 'Align QR code within the frame'}
          </Text>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#6FC49A" size="small" />
              <Text style={styles.bottomText}>Resolving QR…</Text>
            </View>
          ) : (
            <Text style={styles.bottomText}>
              Point at a TraceBlocks event QR code
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
  camera:    { flex: 1 },               // fills the root, behind overlay

  // Overlay covers everything, children stack top→middle→bottom
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },

  // ── Top band: opaque dark, shrinks to content ──────────────────────────
  topBand: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingTop: Platform.OS === 'android' ? 40 : 56,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  closeBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontSize: 20, fontWeight: '300' },
  topTitle:     { color: '#fff', fontSize: 16, fontWeight: '600' },

  contextWrap: { alignItems: 'center', marginTop: 10 },
  contextBadge: {
    backgroundColor: 'rgba(45,106,79,0.85)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  contextText: { color: '#E8F4EE', fontSize: 12, fontWeight: '500' },

  // ── Middle: transparent, flex:1 so it takes all remaining space ────────
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  viewfinder: { width: 240, height: 240 },

  corner: {
    position: 'absolute', width: 36, height: 36,
    borderColor: '#fff', borderWidth: 3,
  },
  tl: { top: 0,    left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 0,    right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 6 },

  // ── Bottom band: opaque dark, shrinks to content ───────────────────────
  bottomBand: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingVertical: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 36 : 44,
    alignItems: 'center',
    gap: 12,
  },
  frameHint:  { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottomText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, textAlign: 'center' },
  rescanBtn:  {
    backgroundColor: 'rgba(45,106,79,0.9)',
    borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10,
  },
  rescanText: { color: '#E8F4EE', fontSize: 13, fontWeight: '600' },

  // ── Permission / loading screens ───────────────────────────────────────
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F3EE', padding: 32,
  },
  permTitle:   { fontSize: 18, fontWeight: '600', color: '#1C1A17', marginBottom: 8, textAlign: 'center' },
  permSub:     { fontSize: 14, color: '#7A7669', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  permBtn:     { backgroundColor: '#2D6A4F', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 16 },
  permBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  backLink:    { color: '#7A7669', fontSize: 14, marginTop: 8 },
});