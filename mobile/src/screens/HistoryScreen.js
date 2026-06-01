import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { apiGetEvents } from '../services/api';

const STATUS_COLORS = {
  manufactured:     { bg: '#E8F1FB', text: '#1E5FA6' },
  shipped:          { bg: '#E8F4EE', text: '#2D6A4F' },
  in_transit:       { bg: '#FEF6E4', text: '#8A5E0A' },
  at_hub:           { bg: '#FBF0EA', text: '#B5653A' },
  out_for_delivery: { bg: '#EAF3DE', text: '#3B6D11' },
  delivered:        { bg: '#E8F4EE', text: '#2D6A4F' },
  handover:         { bg: '#E8F1FB', text: '#1E5FA6' },
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryScreen({ navigation, route }) {
  const { sku, name } = route.params;
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetEvents(sku)
      .then((res) => setEvents(res.data.events))
      .catch(() => Alert.alert('Error', 'Could not load event history.'))
      .finally(() => setLoading(false));
  }, [sku]);

  const renderEvent = ({ item, index }) => {
    const colors  = STATUS_COLORS[item.status] || { bg: '#F5F3EE', text: '#7A7669' };
    const isFirst = index === 0;
    const txShort = item.tx_id
      ? (item.tx_id.startsWith('mock') ? item.tx_id : item.tx_id.slice(0, 20) + '…')
      : null;

    return (
      <View style={styles.eventRow}>
        {/* Timeline dot + line */}
        <View style={styles.timelineCol}>
          <View style={[styles.dot, isFirst && styles.dotLatest]} />
          <View style={styles.line} />
        </View>

        {/* Event card */}
        <View style={styles.eventCard}>
          <View style={styles.eventTop}>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>
                {item.status_display}
              </Text>
            </View>
            <Text style={styles.eventTime}>{formatDate(item.timestamp)}</Text>
          </View>

          <Text style={styles.eventLoc}>📍 {item.location}</Text>

          {item.latitude && item.longitude && (
            <Text style={styles.eventGps}>
              ⊕ {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
          )}

          {item.notes ? <Text style={styles.eventNotes}>{item.notes}</Text> : null}

          {txShort && (
            <View style={styles.txRow}>
              <View style={[
                styles.txBadge,
                item.tx_status === 'confirmed' && styles.txConfirmed,
                item.tx_status === 'pending'   && styles.txPending,
                item.tx_status === 'error'     && styles.txError,
              ]}>
                <Text style={styles.txBadgeText}>{item.tx_status}</Text>
              </View>
              <Text style={styles.txHash}>{txShort}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{name}</Text>
          <Text style={styles.headerSku}>{sku}</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2D6A4F" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>// No events recorded yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EE' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
  },
  backText:     { color: 'rgba(208,235,224,0.7)', fontSize: 14 },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { color: '#E8F4EE', fontSize: 16, fontWeight: '600' },
  headerSku:    { color: 'rgba(111,196,154,0.5)', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },

  list: { padding: 16 },

  eventRow: { flexDirection: 'row', marginBottom: 4 },

  timelineCol: { width: 24, alignItems: 'center', paddingTop: 6 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#7A7669',
    borderWidth: 2, borderColor: '#F5F3EE',
    zIndex: 1,
  },
  dotLatest: { backgroundColor: '#2D6A4F', width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 2, backgroundColor: '#E2DED6', marginTop: 2 },

  eventCard: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E2DED6',
    padding: 12, marginLeft: 10, marginBottom: 12,
  },
  eventTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  badge:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventTime: { fontSize: 11, color: '#A8A49A', fontFamily: 'monospace' },

  eventLoc:   { fontSize: 13, color: '#7A7669', marginBottom: 3 },
  eventGps:   { fontSize: 11, color: '#2D6A4F', fontFamily: 'monospace', marginBottom: 3 },
  eventNotes: { fontSize: 12, color: '#A8A49A', fontStyle: 'italic', marginBottom: 4 },

  txRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  txBadge:  { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  txBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  txConfirmed: { backgroundColor: '#E8F4EE' },
  txPending:   { backgroundColor: '#FEF6E4' },
  txError:     { backgroundColor: '#FBE8E8' },
  txHash:      { fontSize: 11, color: '#7A7669', fontFamily: 'monospace', flex: 1 },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 13, color: '#A8A49A', fontFamily: 'monospace' },
});