import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  Alert, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiGetProducts } from '../services/api';
import { getUser, clearSession } from '../services/auth';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [user,        setUser]        = useState(null);
  const [query,       setQuery]       = useState('');
  const [expandedSku, setExpandedSku] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [prodRes, u] = await Promise.all([apiGetProducts(), getUser()]);
      setProducts(prodRes.data?.products ?? []);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.manufacturer || '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const toggleExpand = (sku) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSku((prev) => (prev === sku ? null : sku));
  };

  const handleHistory  = (item) =>
    navigation.navigate('History',   { sku: item.sku, name: item.name });

  const handleLogEvent = (item) =>
    navigation.navigate('ManualLog', { product: { sku: item.sku, name: item.name } });

  const renderProduct = ({ item }) => {
    const colors     = STATUS_COLORS[item.current_status] || { bg: '#F5F3EE', text: '#7A7669' };
    const isExpanded = expandedSku === item.sku;
    const q          = query.trim().toLowerCase();
    const nameMatch  = q && item.name.toLowerCase().includes(q);
    const skuMatch   = q && item.sku.toLowerCase().includes(q);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => toggleExpand(item.sku)}
        style={styles.card}
      >
        {/* Left colour strip */}
        <View style={[styles.cardStrip, { backgroundColor: colors.text }]} />

        <View style={styles.cardInner}>

          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={styles.cardInfo}>
              <Text style={[styles.productName, nameMatch && styles.highlighted]}>
                {item.name}
              </Text>
              <Text style={[styles.productSku, skuMatch && styles.highlightedMono]}>
                {item.sku}
              </Text>
              {item.manufacturer
                ? <Text style={styles.productMfr}>{item.manufacturer}</Text>
                : null}
            </View>

            <View style={styles.cardTopRight}>
              <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.statusText, { color: colors.text }]}>
                  {item.current_status.replace(/_/g, ' ')}
                </Text>
              </View>
              <Text style={[styles.chevron, isExpanded && styles.chevronUp]}>›</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Action row */}
          <View style={styles.cardBottom}>
            <View style={styles.eventCountBadge}>
              <Text style={styles.eventCountText}>
                {item.event_count} event{item.event_count !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => { e.stopPropagation?.(); handleHistory(item); }}
              >
                <Text style={styles.actionBtnIcon}>◷</Text>
                <Text style={styles.actionBtnText}>History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logBtn}
                onPress={(e) => { e.stopPropagation?.(); handleLogEvent(item); }}
              >
                <Text style={styles.logBtnText}>+ Log Event</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Expanded details */}
          {isExpanded && (
            <View style={styles.expandedPanel}>
              <View style={styles.expandedDivider} />

              <View style={styles.detailGrid}>
                <DetailRow label="SKU"      value={item.sku} mono />
                {item.batch_id    && <DetailRow label="Batch"       value={item.batch_id} mono />}
                {item.origin      && <DetailRow label="Origin"      value={item.origin} />}
                {item.category    && <DetailRow label="Category"    value={item.category} />}
                {item.weight_kg   && <DetailRow label="Weight"      value={`${item.weight_kg} kg`} />}
                {item.created_at  && (
                  <DetailRow
                    label="Registered"
                    value={new Date(item.created_at).toLocaleDateString('en-KE', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  />
                )}
                {item.last_event_at && (
                  <DetailRow
                    label="Last event"
                    value={new Date(item.last_event_at).toLocaleDateString('en-KE', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  />
                )}
                {item.description && (
                  <DetailRow label="Description" value={item.description} full />
                )}
              </View>
            </View>
          )}

        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
        <Text style={styles.loadingText}>Loading products…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>TraceBlocks</Text>
          {user && <Text style={styles.headerSub}>// {user.username}</Text>}
        </View>
        <View style={styles.netBadge}>
          <View style={styles.netDot} />
          <Text style={styles.netText}>VeChain Testnet</Text>
        </View>
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filtered.length}{query ? ` of ${products.length}` : ''}{' '}
          product{products.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={styles.newProductBtn}
          onPress={() => navigation.navigate('CreateProduct')}
        >
          <Text style={styles.newProductText}>+ New Product</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⊕</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, SKU, or manufacturer…"
            placeholderTextColor="#A8A49A"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.sku}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={['#2D6A4F']}
            tintColor="#2D6A4F"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {query ? (
              <>
                <Text style={styles.emptyIcon}>⊘</Text>
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptyText}>
                  Try a different name, SKU, or manufacturer.
                </Text>
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  style={styles.clearSearchBtn}
                >
                  <Text style={styles.clearSearchText}>Clear search</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyIcon}>⊡</Text>
                <Text style={styles.emptyTitle}>No products yet</Text>
                <Text style={styles.emptyText}>
                  // Register your first product to start tracking.
                </Text>
                <TouchableOpacity
                  style={[styles.newProductBtn, { marginTop: 16 }]}
                  onPress={() => navigation.navigate('CreateProduct')}
                >
                  <Text style={styles.newProductText}>+ Create First Product</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

function DetailRow({ label, value, mono = false, full = false }) {
  return (
    <View style={[styles.detailRow, full && styles.detailRowFull]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, mono && styles.detailValueMono]}
        numberOfLines={full ? 3 : 1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F5F3EE' },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3EE', gap: 10 },
  loadingText: { fontSize: 12, color: '#7A7669', fontFamily: 'monospace' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22', paddingHorizontal: 20,
    paddingTop: 56, paddingBottom: 16,
  },
  headerTitle: { color: '#E8F4EE', fontSize: 20, fontWeight: '300', letterSpacing: -0.5 },
  headerSub:   { color: 'rgba(111,196,154,0.5)', fontSize: 11, fontFamily: 'monospace', marginTop: 2, letterSpacing: 0.3 },
  netBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(45,106,79,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  netDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6FC49A' },
  netText:     { fontSize: 10, color: 'rgba(208,235,224,0.6)', letterSpacing: 0.3 },

  statsBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2DED6' },
  statsText:      { fontSize: 12, color: '#7A7669', fontWeight: '500' },
  newProductBtn:  { backgroundColor: '#2D6A4F', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  newProductText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  searchWrap:  { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2DED6' },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#CCC9BF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  searchIcon:  { fontSize: 14, color: '#A8A49A' },
  searchInput: { flex: 1, fontSize: 13, color: '#1C1A17', paddingVertical: 0 },
  clearBtn:     { padding: 4 },
  clearBtnText: { fontSize: 12, color: '#A8A49A', fontWeight: '600' },

  list: { padding: 16, gap: 10, paddingBottom: 32 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E2DED6',
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardStrip:    { width: 3 },
  cardInner:    { flex: 1, padding: 14 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTopRight: { alignItems: 'flex-end', gap: 6 },
  cardInfo:     { flex: 1, marginRight: 10 },
  productName:  { fontSize: 14, fontWeight: '600', color: '#1C1A17', marginBottom: 3 },
  productSku:   { fontSize: 11, color: '#7A7669', fontFamily: 'monospace' },
  productMfr:   { fontSize: 11, color: '#A8A49A', marginTop: 2 },

  highlighted:     { color: '#2D6A4F' },
  highlightedMono: { color: '#2D6A4F' },

  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText:  { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  chevron:    { fontSize: 20, color: '#A8A49A', fontWeight: '300', transform: [{ rotate: '90deg' }], lineHeight: 22 },
  chevronUp:  { transform: [{ rotate: '-90deg' }] },

  cardDivider: { height: 1, backgroundColor: '#F5F3EE', marginBottom: 10 },

  cardBottom:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  eventCountBadge: { backgroundColor: '#E8F4EE', borderWidth: 1, borderColor: '#B5D9C8', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  eventCountText:  { fontSize: 10, color: '#2D6A4F', fontFamily: 'monospace', fontWeight: '600' },
  cardActions:     { flexDirection: 'row', gap: 6, alignItems: 'center' },

  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#CCC9BF', backgroundColor: '#FAFAF8' },
  actionBtnIcon: { fontSize: 12, color: '#7A7669' },
  actionBtnText: { fontSize: 11, color: '#7A7669', fontWeight: '500' },
  logBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#2D6A4F' },
  logBtnText:    { fontSize: 11, color: '#fff', fontWeight: '700' },

  expandedPanel:   { marginTop: 2 },
  expandedDivider: { height: 1, backgroundColor: '#E2DED6', marginTop: 10, marginBottom: 12 },
  detailGrid:      { gap: 6 },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailRowFull:   { flexDirection: 'column', gap: 2 },
  detailLabel:     { fontSize: 10, color: '#A8A49A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue:     { fontSize: 12, color: '#1C1A17', fontWeight: '500', maxWidth: '65%', textAlign: 'right' },
  detailValueMono: { fontFamily: 'monospace', color: '#2D6A4F' },

  empty:          { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 6 },
  emptyIcon:      { fontSize: 32, color: '#CCC9BF', marginBottom: 8 },
  emptyTitle:     { fontSize: 15, fontWeight: '600', color: '#7A7669' },
  emptyText:      { fontSize: 12, color: '#A8A49A', fontFamily: 'monospace', textAlign: 'center', lineHeight: 18 },
  clearSearchBtn:  { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#CCC9BF' },
  clearSearchText: { fontSize: 13, color: '#7A7669', fontWeight: '500' },
});