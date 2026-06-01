import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetProducts } from '../services/api';
import { getUser, clearSession } from '../services/auth';

const STATUS_COLORS = {
  manufactured:     { bg: '#E8F1FB', text: '#1E5FA6' },
  shipped:          { bg: '#E8F4EE', text: '#2D6A4F' },
  in_transit:       { bg: '#FEF6E4', text: '#8A5E0A' },
  at_hub:           { bg: '#FBF0EA', text: '#B5653A' },
  out_for_delivery: { bg: '#EAF3DE', text: '#3B6D11' },
  delivered:        { bg: '#E8F4EE', text: '#2D6A4F' },
  handover:         { bg: '#E8F1FB', text: '#1E5FA6' },
};

export default function HomeScreen({ navigation }) {
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user,      setUser]      = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [prodRes, u] = await Promise.all([apiGetProducts(), getUser()]);
      setProducts(prodRes.data.products);
      setUser(u);
    } catch (err) {
      if (err.response?.status === 401) {
        await clearSession();
        navigation.replace('Login');
      } else {
        Alert.alert('Error', 'Could not load products.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleLogout = async () => {
    await clearSession();
    navigation.replace('Login');
  };

  const renderProduct = ({ item }) => {
    const colors = STATUS_COLORS[item.current_status] || { bg: '#F5F3EE', text: '#7A7669' };
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productSku}>{item.sku}</Text>
            {item.manufacturer ? (
              <Text style={styles.productMfr}>{item.manufacturer}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>
              {item.current_status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.eventCount}>{item.event_count} event{item.event_count !== 1 ? 's' : ''}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => navigation.navigate('History', { sku: item.sku, name: item.name })}
            >
              <Text style={styles.historyBtnText}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => navigation.navigate('Scan', { sku: item.sku, name: item.name })}
            >
              <Text style={styles.scanBtnText}>⊡ Scan QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TraceBlocks</Text>
          {user && <Text style={styles.headerSub}>Hello, {user.username}</Text>}
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>{products.length} product{products.length !== 1 ? 's' : ''}</Text>
        <View style={styles.netBadge}>
          <View style={styles.netDot} />
          <Text style={styles.netText}>VeChain Testnet</Text>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.sku}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={['#2D6A4F']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>// No products found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F3EE' },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3EE' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 16,
  },
  headerTitle: { color: '#E8F4EE', fontSize: 20, fontWeight: '300', letterSpacing: -0.5 },
  headerSub:   { color: 'rgba(111,196,154,0.6)', fontSize: 12, marginTop: 2 },
  logoutBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(45,106,79,0.3)' },
  logoutText:  { color: 'rgba(208,235,224,0.7)', fontSize: 12 },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2DED6',
  },
  statsText: { fontSize: 12, color: '#7A7669', fontWeight: '500' },
  netBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#CCC9BF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  netDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2D6A4F' },
  netText:   { fontSize: 11, color: '#7A7669' },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E2DED6',
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardInfo:    { flex: 1, marginRight: 10 },
  productName: { fontSize: 15, fontWeight: '600', color: '#1C1A17', marginBottom: 3 },
  productSku:  { fontSize: 11, color: '#7A7669', fontFamily: 'monospace' },
  productMfr:  { fontSize: 12, color: '#A8A49A', marginTop: 2 },

  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  cardBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventCount:  { fontSize: 12, color: '#A8A49A' },
  cardActions: { flexDirection: 'row', gap: 8 },

  historyBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#CCC9BF',
  },
  historyBtnText: { fontSize: 12, color: '#7A7669', fontWeight: '500' },

  scanBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8, backgroundColor: '#2D6A4F',
  },
  scanBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 13, color: '#A8A49A', fontFamily: 'monospace' },
});