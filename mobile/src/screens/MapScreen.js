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

export default function MapScreen({ navigation }) {
  const mapRef = useRef(null);

  const [products,      setProducts]      = useState([]);
  const [pins,          setPins]          = useState([]); // [{product, lat, lng, status}]
  const [loading,       setLoading]       = useState(true);

  // Route overlay state
  const [routeProduct,  setRouteProduct]  = useState(null);
  const [routeCoords,   setRouteCoords]   = useState([]);
  const [routeEvents,   setRouteEvents]   = useState([]);
  const [routeLoading,  setRouteLoading]  = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await apiGetProducts();
      const prods = res.data.products;
      setProducts(prods);

      // For each product fetch its events and find the latest with GPS
      const pinPromises = prods.map(async (p) => {
        try {
          const evRes = await apiGetEvents(p.sku);
          const events = evRes.data.events;
          const latest = events.find((e) => e.latitude && e.longitude);
          if (latest) {
            return {
              sku:    p.sku,
              name:   p.name,
              status: p.current_status,
              lat:    latest.latitude,
              lng:    latest.longitude,
              time:   latest.timestamp,
            };
          }
        } catch { /* product has no events */ }
        return null;
      });

      const resolved = (await Promise.all(pinPromises)).filter(Boolean);
      setPins(resolved);
    } catch (err) {
      Alert.alert('Error', 'Could not load map data.');
    } finally {
      setLoading(false);
    }
  };

  const loadRoute = async (sku, name) => {
    setRouteProduct({ sku, name });
    setRouteLoading(true);
    setShowRouteModal(true);
    try {
      const res    = await apiGetEvents(sku);
      const events = res.data.events
        .filter((e) => e.latitude && e.longitude)
        .reverse(); // oldest first for route order
      setRouteEvents(events);
      setRouteCoords(events.map((e) => ({ latitude: e.latitude, longitude: e.longitude })));
    } catch {
      Alert.alert('Error', 'Could not load route.');
      setShowRouteModal(false);
    } finally {
      setRouteLoading(false);
    }
  };

  const fitToMarkers = () => {
    if (pins.length === 0 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(
      pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 80, right: 40, bottom: 80, left: 40 }, animated: true },
    );
  };

  // Default region — East Africa
  const defaultRegion = {
    latitude:      -0.5,
    longitude:     36.5,
    latitudeDelta:  8,
    longitudeDelta: 8,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Map</Text>
        <TouchableOpacity onPress={loadOverview}>
          <Text style={styles.refreshText}>↺</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D6A4F" />
          <Text style={styles.loadingText}>Loading GPS data…</Text>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={defaultRegion}
            onMapReady={fitToMarkers}
            showsUserLocation
            showsMyLocationButton
          >
            {pins.map((pin) => (
              <Marker
                key={pin.sku}
                coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                pinColor={STATUS_COLORS[pin.status] || '#7A7669'}
              >
                <Callout onPress={() => loadRoute(pin.sku, pin.name)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutName}>{pin.name}</Text>
                    <Text style={styles.calloutSku}>{pin.sku}</Text>
                    <Text style={styles.calloutStatus}>
                      {pin.status.replace('_', ' ')}
                    </Text>
                    <Text style={styles.calloutAction}>Tap to view route →</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {/* Product list at bottom */}
          <View style={styles.productList}>
            <Text style={styles.productListTitle}>
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
                  style={styles.productChip}
                  onPress={() => loadRoute(item.sku, item.name)}
                >
                  <View style={[styles.chipDot, { backgroundColor: STATUS_COLORS[item.status] || '#7A7669' }]} />
                  <Text style={styles.chipText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noGpsText}>No GPS data yet — log events with location enabled.</Text>
              }
            />
          </View>
        </>
      )}

      {/* Route modal */}
      <Modal visible={showRouteModal} animationType="slide" onRequestClose={() => setShowRouteModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRouteModal(false)}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.modalHeaderCenter}>
              <Text style={styles.headerTitle}>{routeProduct?.name}</Text>
              <Text style={styles.headerSku}>{routeProduct?.sku}</Text>
            </View>
            <View style={{ width: 48 }} />
          </View>

          {routeLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2D6A4F" />
            </View>
          ) : routeCoords.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.noGpsText}>No GPS coordinates recorded for this product yet.</Text>
            </View>
          ) : (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude:      routeCoords[0].latitude,
                longitude:     routeCoords[0].longitude,
                latitudeDelta:  0.5,
                longitudeDelta: 0.5,
              }}
              onMapReady={() => {
                /* fitToCoordinates handled by onMapReady below */
              }}
              ref={(ref) => {
                if (ref && routeCoords.length > 1) {
                  setTimeout(() => {
                    ref.fitToCoordinates(routeCoords, {
                      edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
                      animated: true,
                    });
                  }, 300);
                }
              }}
            >
              {/* Route line */}
              {routeCoords.length > 1 && (
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#2D6A4F"
                  strokeWidth={3}
                  lineDashPattern={[8, 4]}
                />
              )}

              {/* Event markers */}
              {routeEvents.map((e, i) => (
                <Marker
                  key={e.id}
                  coordinate={{ latitude: e.latitude, longitude: e.longitude }}
                  pinColor={i === routeEvents.length - 1 ? '#2D6A4F' : '#7A7669'}
                >
                  <Callout>
                    <View style={styles.callout}>
                      <Text style={styles.calloutName}>{e.status_display}</Text>
                      <Text style={styles.calloutSku}>{e.location}</Text>
                      <Text style={styles.calloutStatus}>
                        {new Date(e.timestamp).toLocaleDateString('en-KE', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>
          )}

          {/* Route event list */}
          {!routeLoading && routeEvents.length > 0 && (
            <View style={styles.routeList}>
              <FlatList
                data={routeEvents}
                keyExtractor={(e) => String(e.id)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
                renderItem={({ item, index }) => (
                  <View style={styles.routeChip}>
                    <View style={[styles.chipDot, {
                      backgroundColor: index === routeEvents.length - 1 ? '#2D6A4F' : '#7A7669'
                    }]} />
                    <View>
                      <Text style={styles.chipText}>{item.status_display}</Text>
                      <Text style={styles.chipSub}>{item.location}</Text>
                    </View>
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F3EE' },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  map:        { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
  },
  backText:    { color: 'rgba(208,235,224,0.7)', fontSize: 14 },
  refreshText: { color: 'rgba(208,235,224,0.7)', fontSize: 22 },
  headerTitle: { color: '#E8F4EE', fontSize: 16, fontWeight: '600' },
  loadingText: { color: '#7A7669', fontSize: 13 },

  callout: { width: 180, padding: 4 },
  calloutName:   { fontSize: 14, fontWeight: '700', color: '#1C1A17', marginBottom: 2 },
  calloutSku:    { fontSize: 11, color: '#7A7669', fontFamily: 'monospace', marginBottom: 2 },
  calloutStatus: { fontSize: 12, color: '#2D6A4F', fontWeight: '600', marginBottom: 4 },
  calloutAction: { fontSize: 11, color: '#1E5FA6' },

  productList: {
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2DED6',
    paddingVertical: 12,
  },
  productListTitle: {
    fontSize: 11, color: '#7A7669', fontFamily: 'monospace',
    paddingHorizontal: 16, marginBottom: 8,
  },
  productChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipDot:  { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 12, color: '#1C1A17', fontWeight: '500' },
  chipSub:  { fontSize: 10, color: '#7A7669' },
  noGpsText: { fontSize: 12, color: '#A8A49A', paddingHorizontal: 16 },

  modalContainer:   { flex: 1, backgroundColor: '#F5F3EE' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
  },
  modalHeaderCenter: { alignItems: 'center' },
  headerSku: { color: 'rgba(111,196,154,0.5)', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },

  routeList: {
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2DED6',
    paddingVertical: 12,
  },
  routeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
});