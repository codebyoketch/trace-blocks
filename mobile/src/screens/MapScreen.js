import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, FlatList, Modal, Alert,
} from 'react-native';
import MapView, { Marker, Polyline, Callout } from 'react-native-maps';
import { apiGetProducts, apiGetEvents } from '../services/api';

const STATUS_COLORS = {
  manufactured:     '#1E5FA6',
  shipped:          '#2D6A4F',
  in_transit:       '#8A5E0A',
  at_hub:           '#B5653A',
  out_for_delivery: '#3B6D11',
  delivered:        '#2D6A4F',
  handover:         '#1E5FA6',
};

export default function MapScreen({ navigation, route }) {
  const mapRef      = useRef(null);
  const routeMapRef = useRef(null);

  const focusSku  = route?.params?.sku  ?? null;
  const focusName = route?.params?.name ?? null;

  const [products,       setProducts]       = useState([]);
  const [pins,           setPins]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [routeProduct,   setRouteProduct]   = useState(null);
  const [routeCoords,    setRouteCoords]    = useState([]);
  const [routeEvents,    setRouteEvents]    = useState([]);
  const [routeLoading,   setRouteLoading]   = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);

  useEffect(() => { loadOverview(); }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res   = await apiGetProducts();
      const prods = res.data.products ?? [];
      setProducts(prods);

      const pinPromises = prods.map(async (p) => {
        try {
          const evRes  = await apiGetEvents(p.sku);
          const events = evRes.data?.events ?? [];
          const latest = events.find(
            (e) => e.latitude != null && e.longitude != null
          );
          if (latest) {
            return {
              sku:    p.sku,
              name:   p.name,
              status: p.current_status,
              lat:    parseFloat(latest.latitude),
              lng:    parseFloat(latest.longitude),
              time:   latest.timestamp,
            };
          }
        } catch { /* product has no events */ }
        return null;
      });

      const resolved = (await Promise.all(pinPromises)).filter(Boolean);
      setPins(resolved);

      if (focusSku) {
        // small delay so the overview map finishes mounting first
        setTimeout(() => loadRoute(focusSku, focusName || focusSku), 600);
      }
    } catch {
      Alert.alert('Error', 'Could not load map data.');
    } finally {
      setLoading(false);
    }
  };

  const loadRoute = async (sku, name) => {
    setRouteProduct({ sku, name });
    setRouteCoords([]);
    setRouteEvents([]);
    setRouteLoading(true);
    setShowRouteModal(true);
    try {
      const res    = await apiGetEvents(sku);
      const events = (res.data?.events ?? [])
        .filter((e) => e.latitude != null && e.longitude != null)
        .reverse();
      const coords = events.map((e) => ({
        latitude:  parseFloat(e.latitude),
        longitude: parseFloat(e.longitude),
      }));
      setRouteEvents(events);
      setRouteCoords(coords);
    } catch {
      Alert.alert('Error', 'Could not load route.');
      setShowRouteModal(false);
    } finally {
      setRouteLoading(false);
    }
  };

  const fitOverviewToMarkers = () => {
    if (!mapRef.current || pins.length === 0) return;
    mapRef.current.fitToCoordinates(
      pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 80, right: 40, bottom: 160, left: 40 }, animated: true },
    );
  };

  const fitRouteMap = () => {
    if (!routeMapRef.current || routeCoords.length === 0) return;
    routeMapRef.current.fitToCoordinates(routeCoords, {
      edgePadding: { top: 80, right: 40, bottom: 160, left: 40 },
      animated: true,
    });
  };

  const defaultRegion = {
    latitude: -0.5, longitude: 36.5,
    latitudeDelta: 8, longitudeDelta: 8,
  };

  return (
    <View style={styles.container}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{focusName ?? 'Product Map'}</Text>
        <TouchableOpacity onPress={loadOverview}>
          <Text style={styles.refreshText}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text style={styles.loadingText}>Loading GPS data…</Text>
        </View>
      ) : (
        /*
          mapWrapper: flex:1 with NO explicit height and NO background color.
          MapView fills it with absoluteFillObject so it has a real parent
          size to measure against.
        */
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={defaultRegion}
            onMapReady={fitOverviewToMarkers}
            showsUserLocation
            showsMyLocationButton
          >
            {pins.map((pin) => (
              <Marker
                key={pin.sku}
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                pinColor={STATUS_COLORS[pin.status] || '#7A7669'}
                opacity={focusSku && pin.sku !== focusSku ? 0.35 : 1}
              >
                <Callout onPress={() => loadRoute(pin.sku, pin.name)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutName}>{pin.name}</Text>
                    <Text style={styles.calloutSku}>{pin.sku}</Text>
                    <Text style={styles.calloutStatus}>
                      {pin.status.replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.calloutAction}>Tap to view route →</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {/* chip tray floats over the map at the bottom */}
          <View style={styles.chipTray}>
            <Text style={styles.chipTrayTitle}>
              {pins.length} of {products.length} products have GPS data
            </Text>
            <FlatList
              data={pins}
              keyExtractor={(item) => item.sku}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.productChip,
                    focusSku === item.sku && styles.productChipActive,
                  ]}
                  onPress={() => loadRoute(item.sku, item.name)}
                >
                  <View style={[styles.chipDot,
                    { backgroundColor: STATUS_COLORS[item.status] || '#7A7669' }]}
                  />
                  <Text style={[
                    styles.chipText,
                    focusSku === item.sku && styles.chipTextActive,
                  ]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noGpsText}>
                  No GPS data yet — log events with location enabled.
                </Text>
              }
            />
          </View>
        </View>
      )}

      {/* ── Route modal ───────────────────────────────────────────────────── */}
      <Modal
        visible={showRouteModal}
        animationType="slide"
        onRequestClose={() => setShowRouteModal(false)}
      >
        <View style={styles.container}>

          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowRouteModal(false)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.headerTitle}>{routeProduct?.name}</Text>
              <Text style={styles.headerSku}>{routeProduct?.sku}</Text>
            </View>
            <View style={{ width: 48 }} />
          </View>

          {routeLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2D6A4F" />
              <Text style={styles.loadingText}>Loading route…</Text>
            </View>
          ) : routeCoords.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>⊡</Text>
              <Text style={styles.noGpsTitle}>No GPS data yet</Text>
              <Text style={styles.noGpsText}>
                Log events with location enabled to see this product's route.
              </Text>
              <TouchableOpacity
                style={styles.logEventBtn}
                onPress={() => {
                  setShowRouteModal(false);
                  navigation.navigate('ManualLog', {
                    product: { sku: routeProduct.sku, name: routeProduct.name },
                  });
                }}
              >
                <Text style={styles.logEventBtnText}>+ Log an Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mapWrapper}>
              <MapView
                ref={routeMapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude:      routeCoords[0].latitude,
                  longitude:     routeCoords[0].longitude,
                  latitudeDelta:  0.5,
                  longitudeDelta: 0.5,
                }}
                onMapReady={fitRouteMap}
              >
                {routeCoords.length > 1 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#2D6A4F"
                    strokeWidth={3}
                    lineDashPattern={[8, 4]}
                  />
                )}
                {routeEvents.map((e, i) => (
                  <Marker
                    key={String(e.id)}
                    coordinate={{
                      latitude:  parseFloat(e.latitude),
                      longitude: parseFloat(e.longitude),
                    }}
                    pinColor={i === routeEvents.length - 1 ? '#2D6A4F' : '#7A7669'}
                  >
                    <Callout>
                      <View style={styles.callout}>
                        <Text style={styles.calloutName}>{e.status_display}</Text>
                        <Text style={styles.calloutSku}>{e.location}</Text>
                        <Text style={styles.calloutStatus}>
                          {new Date(e.timestamp).toLocaleDateString('en-KE', {
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                ))}
              </MapView>

              {/* route event chips float over route map */}
              <View style={styles.chipTray}>
                <FlatList
                  data={routeEvents}
                  keyExtractor={(e) => String(e.id)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
                  renderItem={({ item, index }) => (
                    <View style={styles.routeChip}>
                      <View style={[styles.chipDot, {
                        backgroundColor:
                          index === routeEvents.length - 1 ? '#2D6A4F' : '#7A7669',
                      }]} />
                      <View>
                        <Text style={styles.chipText}>{item.status_display}</Text>
                        <Text style={styles.chipSub}>{item.location}</Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#1A2E22' },
  /*
    mapWrapper: flex:1, NO height, NO background color.
    MapView with absoluteFillObject measures against this and renders correctly.
  */
  mapWrapper: { flex: 1 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#F5F3EE' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
  },
  backText:    { color: 'rgba(208,235,224,0.7)', fontSize: 14 },
  refreshText: { color: 'rgba(208,235,224,0.7)', fontSize: 22 },
  headerTitle: { color: '#E8F4EE', fontSize: 16, fontWeight: '600' },
  headerSku:   { color: 'rgba(111,196,154,0.5)', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  loadingText: { color: '#7A7669', fontSize: 13 },

  callout:       { width: 180, padding: 4 },
  calloutName:   { fontSize: 14, fontWeight: '700', color: '#1C1A17', marginBottom: 2 },
  calloutSku:    { fontSize: 11, color: '#7A7669', fontFamily: 'monospace', marginBottom: 2 },
  calloutStatus: { fontSize: 12, color: '#2D6A4F', fontWeight: '600', marginBottom: 4 },
  calloutAction: { fontSize: 11, color: '#1E5FA6' },

  /* chip tray — absolute, floats at bottom of mapWrapper */
  chipTray: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E2DED6',
    paddingVertical: 12,
  },
  chipTrayTitle: {
    fontSize: 11, color: '#7A7669', fontFamily: 'monospace',
    paddingHorizontal: 16, marginBottom: 8,
  },
  productChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  productChipActive: { backgroundColor: '#E8F4EE', borderColor: '#B5D9C8' },
  chipDot:           { width: 8, height: 8, borderRadius: 4 },
  chipText:          { fontSize: 12, color: '#1C1A17', fontWeight: '500' },
  chipTextActive:    { color: '#2D6A4F', fontWeight: '700' },
  chipSub:           { fontSize: 10, color: '#7A7669' },
  noGpsText:         { fontSize: 12, color: '#A8A49A', paddingHorizontal: 16, textAlign: 'center' },
  noGpsTitle:        { fontSize: 15, fontWeight: '600', color: '#7A7669' },
  emptyIcon:         { fontSize: 32, color: '#CCC9BF' },

  logEventBtn:     { marginTop: 12, backgroundColor: '#2D6A4F', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  logEventBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  routeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
});