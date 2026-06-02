import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { apiCreateProduct } from '../services/api';

// ── tiny helpers ──────────────────────────────────────────────────────────────

const SectionHeader = ({ num, title, color = '#2D6A4F', iconBg = '#E8F4EE' }) => (
  <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
    <View style={[styles.sectionNumBadge, { backgroundColor: iconBg }]}>
      <Text style={[styles.sectionNumText, { color }]}>{num}</Text>
    </View>
    <View>
      <Text style={styles.sectionNumLabel}>Section {String(num).padStart(2, '0')}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  </View>
);

// Field wrapper — shows inline red error when `error` prop is set
const Field = ({ label, required, hint, error, children }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>
      {label}{required && <Text style={styles.req}> *</Text>}
    </Text>
    {children}
    {error  ? <Text style={styles.fieldError}>{error}</Text>  : null}
    {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>
);

// Input — goes red-border when `error` is truthy
const Input = ({ error, ...props }) => (
  <TextInput
    style={[
      styles.input,
      props.multiline && styles.textarea,
      error && styles.inputError,
    ]}
    placeholderTextColor="#A8A49A"
    {...props}
  />
);

// Checkbox row — goes red outline when `error` is set
const CheckRow = ({ label, value, onChange, error }) => (
  <View>
    <TouchableOpacity
      style={[styles.checkRow, error && styles.checkRowError]}
      onPress={() => onChange(!value)}
      activeOpacity={0.8}
    >
      <View style={[styles.checkbox, value && styles.checkboxActive]}>
        {value && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

// Custom select (tap-to-expand dropdown)
const SelectRow = ({ label, required, value, options, onSelect, error }) => {
  const [open, setOpen] = useState(false);
  const display = options.find(o => o.value === value)?.label;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.req}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[styles.selectBtn, error && styles.inputError]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        <Text style={[styles.selectText, !value && { color: '#A8A49A' }]}>
          {display ?? '— Select —'}
        </Text>
        <Text style={styles.selectChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.selectDropdown}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.selectOption, value === opt.value && styles.selectOptionActive]}
              onPress={() => { onSelect(opt.value); setOpen(false); }}
            >
              <Text style={[styles.selectOptionText, value === opt.value && styles.selectOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
};

const Divider  = () => <View style={styles.divider} />;
const SubLabel = ({ children }) => <Text style={styles.subLabel}>{children}</Text>;
const Note     = ({ children }) => (
  <View style={styles.note}><Text style={styles.noteText}>{children}</Text></View>
);

// ── option data ───────────────────────────────────────────────────────────────

const GOODS_CATEGORIES = [
  { value: 'food',        label: 'Food & Agriculture' },
  { value: 'pharma',      label: 'Pharmaceuticals' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'textiles',    label: 'Textiles & Apparel' },
  { value: 'chemicals',   label: 'Chemicals' },
  { value: 'machinery',   label: 'Machinery & Equipment' },
  { value: 'livestock',   label: 'Livestock' },
  { value: 'other',       label: 'Other' },
];
const UNITS = [
  { value: 'kg',         label: 'Kilograms (kg)' },
  { value: 'g',          label: 'Grams (g)' },
  { value: 'tonnes',     label: 'Tonnes (t)' },
  { value: 'litres',     label: 'Litres (L)' },
  { value: 'units',      label: 'Units / Pieces' },
  { value: 'boxes',      label: 'Boxes / Cartons' },
  { value: 'bags',       label: 'Bags / Sacks' },
  { value: 'pallets',    label: 'Pallets' },
  { value: 'containers', label: 'Containers' },
];
const CONDITIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good',      label: 'Good' },
  { value: 'fair',      label: 'Fair' },
  { value: 'damaged',   label: 'Damaged' },
  { value: 'rejected',  label: 'Rejected / Returned' },
];
const TRANSPORT_MODES = [
  { value: 'road',       label: 'Road (Truck / Van)' },
  { value: 'rail',       label: 'Rail' },
  { value: 'air',        label: 'Air Freight' },
  { value: 'sea',        label: 'Sea / Lake Freight' },
  { value: 'motorcycle', label: 'Motorcycle / Boda Boda' },
  { value: 'foot',       label: 'On Foot / Manual' },
  { value: 'pipeline',   label: 'Pipeline' },
  { value: 'multimodal', label: 'Multimodal' },
];

// ── main screen ───────────────────────────────────────────────────────────────

export default function CreateProductScreen({ navigation }) {
  const scrollRef = useRef(null);

  // § GPS
  const [gps,    setGps]    = useState(null);
  const [gpsMsg, setGpsMsg] = useState('Acquiring GPS…');
  const [gpsOk,  setGpsOk]  = useState(false);

  // § 1 — Identity
  const [eventId,  setEventId]  = useState('TB-EVT-2025-001');
  const [userId,   setUserId]   = useState('');
  const [fullName, setFullName] = useState('');

  // § 2 — Event Description
  const [eventName,            setEventName]            = useState('');
  const [shortDescription,     setShortDescription]     = useState('');
  const [needsDetail,          setNeedsDetail]          = useState(false);
  const [detailedExplanation,  setDetailedExplanation]  = useState('');
  const [exceptionsNoted,      setExceptionsNoted]      = useState(false);
  const [regulatoryFlag,       setRegulatoryFlag]       = useState(false);
  const [qualityCheckPassed,   setQualityCheckPassed]   = useState(false);

  // § 3 — Goods
  const [goodsName,     setGoodsName]     = useState('');
  const [goodsCategory, setGoodsCategory] = useState('');
  const [quantity,      setQuantity]      = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [goodsCondition, setGoodsCondition] = useState('');
  const [batchNumber,   setBatchNumber]   = useState('');
  const [coldChain,     setColdChain]     = useState(false);
  const [hazardous,     setHazardous]     = useState(false);

  // § 4 — Parties
  const [dispatcherName,      setDispatcherName]      = useState('');
  const [dispatcherRole,      setDispatcherRole]      = useState('');
  const [dispatcherSignature, setDispatcherSignature] = useState('');
  const [dispatcherDate,      setDispatcherDate]      = useState('');
  const [dispatcherConfirmed, setDispatcherConfirmed] = useState(false);

  const [recipientName,      setRecipientName]      = useState('');
  const [recipientRole,      setRecipientRole]      = useState('');
  const [recipientSignature, setRecipientSignature] = useState('');
  const [recipientDate,      setRecipientDate]      = useState('');
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);

  // § 5 — Logistics
  const [carrierName,         setCarrierName]         = useState('');
  const [transportMode,       setTransportMode]       = useState('');
  const [originLocation,      setOriginLocation]      = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [dispatchDatetime,    setDispatchDatetime]    = useState('');
  const [estimatedDelivery,   setEstimatedDelivery]   = useState('');
  const [trackingNumber,      setTrackingNumber]      = useState('');
  const [vehiclePlate,        setVehiclePlate]        = useState('');
  const [driverName,          setDriverName]          = useState('');
  const [logisticsNotes,      setLogisticsNotes]      = useState('');
  const [insuranceCovered,    setInsuranceCovered]    = useState(false);
  const [customsCleared,      setCustomsCleared]      = useState(false);

  // § submit
  const [finalConfirm, setFinalConfirm] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  // field-level errors — keyed by field name
  const [errors, setErrors] = useState({});

  // GPS
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsMsg('Location permission denied.'); return; }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setGps({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setGpsOk(true);
        setGpsMsg(
          `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)} ` +
          `(±${Math.round(loc.coords.accuracy)} m)`,
        );
      } catch {
        setGpsMsg('GPS unavailable — event will be recorded without coordinates.');
      }
    })();
  }, []);

  // Clear a field's error as soon as the user edits it
  const clear = (key) => (val) => {
    if (errors[key]) setErrors(prev => { const e = { ...prev }; delete e[key]; return e; });
    return val;
  };

  // Returns an errors object (empty = valid)
  const buildErrors = () => {
    const e = {};
    if (!userId.trim())              e.userId            = 'User ID is required (§ Identity).';
    if (!fullName.trim())            e.fullName          = 'Full Name is required (§ Identity).';
    if (!eventName.trim())           e.eventName         = 'Event Name is required (§ Event Description).';
    if (!goodsName.trim())           e.goodsName         = 'Goods Name is required (§ Goods).';
    if (!goodsCategory)              e.goodsCategory     = 'Select a Goods Category (§ Goods).';
    if (!quantity.trim())            e.quantity          = 'Quantity is required (§ Goods).';
    if (!unitOfMeasure)              e.unitOfMeasure     = 'Select a Unit of Measure (§ Goods).';
    if (!dispatcherName.trim())      e.dispatcherName    = 'Dispatcher Full Name is required (§ Parties).';
    if (!dispatcherDate.trim())      e.dispatcherDate    = 'Dispatcher Date is required (§ Parties).';
    if (!dispatcherConfirmed)        e.dispatcherConfirmed = 'Dispatcher must tick the confirmation (§ Parties).';
    if (!recipientName.trim())       e.recipientName     = 'Recipient Full Name is required (§ Parties).';
    if (!recipientDate.trim())       e.recipientDate     = 'Recipient Date is required (§ Parties).';
    if (!recipientConfirmed)         e.recipientConfirmed  = 'Recipient must tick the confirmation (§ Parties).';
    if (!carrierName.trim())         e.carrierName       = 'Carrier / Logistics Company is required (§ Logistics).';
    if (!transportMode)              e.transportMode     = 'Select a Transport Mode (§ Logistics).';
    if (!originLocation.trim())      e.originLocation    = 'Origin Location is required (§ Logistics).';
    if (!destinationLocation.trim()) e.destinationLocation = 'Destination is required (§ Logistics).';
    if (!finalConfirm)               e.finalConfirm      = 'Tick the accuracy confirmation before submitting.';
    return e;
  };

  const handleSubmit = async () => {
    const errs = buildErrors();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Show a summary pointing to the first problem
      const first = Object.values(errs)[0];
      Alert.alert(
        `${Object.keys(errs).length} field(s) need attention`,
        `First issue: ${first}\n\nAll incomplete fields are highlighted in red below.`,
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        // Legacy fields the Django backend requires on the Product model
        name:                  goodsName.trim(),
        sku:                   batchNumber.trim() || goodsName.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 12) + '-001',
        manufacturer:          dispatcherName.trim(),
        location:              originLocation.trim(),

        // Full event fields
        event_id:              eventId.trim(),
        user_id:               userId.trim(),
        full_name:             fullName.trim(),
        event_name:            eventName.trim(),
        short_description:     shortDescription.trim(),
        needs_detail:          needsDetail          ? 'yes' : 'no',
        detailed_explanation:  detailedExplanation.trim(),
        exceptions_noted:      exceptionsNoted      ? 'yes' : 'no',
        regulatory_flag:       regulatoryFlag       ? 'yes' : 'no',
        quality_check_passed:  qualityCheckPassed   ? 'yes' : 'no',
        goods_name:            goodsName.trim(),
        goods_category:        goodsCategory,
        quantity:              quantity.trim(),
        unit_of_measure:       unitOfMeasure,
        goods_condition:       goodsCondition,
        batch_number:          batchNumber.trim(),
        cold_chain:            coldChain            ? 'yes' : 'no',
        hazardous:             hazardous            ? 'yes' : 'no',
        dispatcher_name:       dispatcherName.trim(),
        dispatcher_role:       dispatcherRole.trim(),
        dispatcher_signature:  dispatcherSignature.trim(),
        dispatcher_date:       dispatcherDate.trim(),
        dispatcher_confirmed:  dispatcherConfirmed  ? 'yes' : 'no',
        recipient_name:        recipientName.trim(),
        recipient_role:        recipientRole.trim(),
        recipient_signature:   recipientSignature.trim(),
        recipient_date:        recipientDate.trim(),
        recipient_confirmed:   recipientConfirmed   ? 'yes' : 'no',
        carrier_name:          carrierName.trim(),
        transport_mode:        transportMode,
        origin_location:       originLocation.trim(),
        destination_location:  destinationLocation.trim(),
        dispatch_datetime:     dispatchDatetime.trim(),
        estimated_delivery:    estimatedDelivery.trim(),
        tracking_number:       trackingNumber.trim(),
        vehicle_plate:         vehiclePlate.trim(),
        driver_name:           driverName.trim(),
        logistics_notes:       logisticsNotes.trim(),
        insurance_covered:     insuranceCovered     ? 'yes' : 'no',
        customs_cleared:       customsCleared       ? 'yes' : 'no',
        latitude:              gps?.latitude  ?? null,
        longitude:             gps?.longitude ?? null,
      };

      const res = await apiCreateProduct(payload);
      Alert.alert(
        'Event Recorded ✓',
        `${eventName}\n\nTX: ${res.data.tx_id?.slice(0, 24)}…`,
        [{ text: 'Done', onPress: () => navigation.navigate('Main') }],
      );
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to record event.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.inner}
      keyboardShouldPersistTaps="handled"
    >

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Record Event</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* PAGE HEADER */}
      <View style={styles.pageHeader}>
        <View style={styles.eventIdRow}>
          <Text style={styles.eventIdLabel}>Event ID</Text>
          <TextInput
            style={styles.eventIdInput}
            value={eventId}
            onChangeText={setEventId}
            autoCapitalize="characters"
          />
        </View>
        <Text style={styles.pageTitle}>Supply Chain{'\n'}Event</Text>
        <Text style={styles.pageSubtitle}>
          All details are immutably recorded on the VeChainThor blockchain once submitted.
        </Text>
      </View>

      {/* GPS STRIP */}
      <View style={[styles.gpsStrip, gpsOk && styles.gpsStripOk]}>
        <Text style={styles.gpsDot}>{gpsOk ? '●' : '○'}</Text>
        <Text style={[styles.gpsText, gpsOk && styles.gpsTextOk]}>{gpsMsg}</Text>
      </View>

      {/* error summary banner */}
      {Object.keys(errors).length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>
            ⚠ {Object.keys(errors).length} field{Object.keys(errors).length > 1 ? 's' : ''} need attention
          </Text>
          <Text style={styles.errorBannerBody}>
            Incomplete fields are highlighted in red below.
          </Text>
        </View>
      )}

      {/* ═══════════════════════════════════════════
          SECTION 1 · IDENTITY
      ═══════════════════════════════════════════ */}
      <View style={styles.card}>
        <SectionHeader num={1} title="Identity" color="#2D6A4F" iconBg="#E8F4EE" />
        <View style={styles.cardBody}>
          <Field label="User ID" required error={errors.userId}>
            <Input
              value={userId}
              onChangeText={v => { setUserId(v); clear('userId')(v); }}
              placeholder="e.g. USR-00142"
              autoCapitalize="characters"
              error={errors.userId}
            />
          </Field>
          <Field label="Full Name" required error={errors.fullName}>
            <Input
              value={fullName}
              onChangeText={v => { setFullName(v); clear('fullName')(v); }}
              placeholder="As registered on the platform"
              autoComplete="name"
              error={errors.fullName}
            />
          </Field>
        </View>
      </View>

      {/* ═══════════════════════════════════════════
          SECTION 2 · EVENT DESCRIPTION
      ═══════════════════════════════════════════ */}
      <View style={styles.card}>
        <SectionHeader num={2} title="Event Description" color="#1E5FA6" iconBg="#E8F1FB" />
        <View style={styles.cardBody}>
          <Field label="Event Name" required error={errors.eventName}>
            <Input
              value={eventName}
              onChangeText={v => { setEventName(v); clear('eventName')(v); }}
              placeholder="e.g. Dispatch from Kisumu Warehouse"
              error={errors.eventName}
            />
          </Field>
          <Field label="Short Description">
            <Input
              value={shortDescription}
              onChangeText={setShortDescription}
              placeholder="Brief summary of this supply chain stage… (optional)"
              multiline
              numberOfLines={3}
            />
          </Field>

          <CheckRow
            label="This event requires a detailed explanation"
            value={needsDetail}
            onChange={setNeedsDetail}
          />

          {needsDetail && (
            <View style={styles.expandableBody}>
              <Field label="Full Explanation">
                <Input
                  value={detailedExplanation}
                  onChangeText={setDetailedExplanation}
                  placeholder="Provide a full paragraph explanation of the event…"
                  multiline
                  numberOfLines={6}
                />
              </Field>
              <CheckRow label="Exceptions or anomalies were noted" value={exceptionsNoted} onChange={setExceptionsNoted} />
              <CheckRow label="This event has a regulatory or compliance flag" value={regulatoryFlag} onChange={setRegulatoryFlag} />
              <CheckRow label="Quality check passed at this stage" value={qualityCheckPassed} onChange={setQualityCheckPassed} />
            </View>
          )}
        </View>
      </View>

      {/* ═══════════════════════════════════════════
          SECTION 3 · GOODS
      ═══════════════════════════════════════════ */}
      <View style={styles.card}>
        <SectionHeader num={3} title="Goods" color="#8A5E0A" iconBg="#FEF6E4" />
        <View style={styles.cardBody}>
          <Field label="Goods Name / Type" required error={errors.goodsName}>
            <Input
              value={goodsName}
              onChangeText={v => { setGoodsName(v); clear('goodsName')(v); }}
              placeholder="e.g. Nile Perch — Frozen, Grade A"
              error={errors.goodsName}
            />
          </Field>

          <SelectRow
            label="Goods Category" required
            value={goodsCategory}
            options={GOODS_CATEGORIES}
            onSelect={v => { setGoodsCategory(v); clear('goodsCategory')(v); }}
            error={errors.goodsCategory}
          />

          <View style={styles.twoCol}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Quantity" required error={errors.quantity}>
                <Input
                  value={quantity}
                  onChangeText={v => { setQuantity(v); clear('quantity')(v); }}
                  placeholder="0"
                  keyboardType="numeric"
                  error={errors.quantity}
                />
              </Field>
            </View>
            <View style={{ flex: 1.4 }}>
              <SelectRow
                label="Unit of Measure" required
                value={unitOfMeasure}
                options={UNITS}
                onSelect={v => { setUnitOfMeasure(v); clear('unitOfMeasure')(v); }}
                error={errors.unitOfMeasure}
              />
            </View>
          </View>

          <SelectRow
            label="Condition"
            value={goodsCondition}
            options={CONDITIONS}
            onSelect={setGoodsCondition}
          />

          <Field label="Batch / Lot Number" hint="Used to generate the product SKU if left blank">
            <Input
              value={batchNumber}
              onChangeText={setBatchNumber}
              placeholder="e.g. KSM-BATCH-2025-044"
              autoCapitalize="characters"
            />
          </Field>

          <CheckRow label="This shipment is part of a cold chain (temperature-controlled)" value={coldChain} onChange={setColdChain} />
          <CheckRow label="Contains hazardous or controlled materials" value={hazardous} onChange={setHazardous} />
        </View>
      </View>

      {/* ═══════════════════════════════════════════
          SECTION 4 · PARTIES
      ═══════════════════════════════════════════ */}
      <View style={styles.card}>
        <SectionHeader num={4} title="Dispatcher & Recipient" color="#B5653A" iconBg="#FBF0EA" />
        <View style={styles.cardBody}>

          <SubLabel>DISPATCHED BY</SubLabel>
          <Note>The person or entity releasing / sending the goods at this stage.</Note>

          <Field label="Full Name" required error={errors.dispatcherName}>
            <Input
              value={dispatcherName}
              onChangeText={v => { setDispatcherName(v); clear('dispatcherName')(v); }}
              placeholder="Dispatcher's full legal name"
              error={errors.dispatcherName}
            />
          </Field>
          <Field label="Role / Title">
            <Input value={dispatcherRole} onChangeText={setDispatcherRole} placeholder="e.g. Warehouse Manager" />
          </Field>
          <View style={styles.twoCol}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Signature (type full name)">
                <Input value={dispatcherSignature} onChangeText={setDispatcherSignature} placeholder="Type full name to sign" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Date" required error={errors.dispatcherDate}>
                <Input
                  value={dispatcherDate}
                  onChangeText={v => { setDispatcherDate(v); clear('dispatcherDate')(v); }}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  error={errors.dispatcherDate}
                />
              </Field>
            </View>
          </View>
          <CheckRow
            label="I confirm the above goods have been released and the details are accurate"
            value={dispatcherConfirmed}
            onChange={v => { setDispatcherConfirmed(v); if (v) setErrors(p => { const e={...p}; delete e.dispatcherConfirmed; return e; }); }}
            error={errors.dispatcherConfirmed}
          />

          <Divider />

          <SubLabel>RECIPIENT</SubLabel>
          <Note>The person or entity receiving the goods at this stage.</Note>

          <Field label="Full Name" required error={errors.recipientName}>
            <Input
              value={recipientName}
              onChangeText={v => { setRecipientName(v); clear('recipientName')(v); }}
              placeholder="Recipient's full legal name"
              error={errors.recipientName}
            />
          </Field>
          <Field label="Role / Title">
            <Input value={recipientRole} onChangeText={setRecipientRole} placeholder="e.g. Retailer, Distributor" />
          </Field>
          <View style={styles.twoCol}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Signature (type full name)">
                <Input value={recipientSignature} onChangeText={setRecipientSignature} placeholder="Type full name to sign" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Date" required error={errors.recipientDate}>
                <Input
                  value={recipientDate}
                  onChangeText={v => { setRecipientDate(v); clear('recipientDate')(v); }}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  error={errors.recipientDate}
                />
              </Field>
            </View>
          </View>
          <CheckRow
            label="I confirm receipt of the above goods and that the details are accurate"
            value={recipientConfirmed}
            onChange={v => { setRecipientConfirmed(v); if (v) setErrors(p => { const e={...p}; delete e.recipientConfirmed; return e; }); }}
            error={errors.recipientConfirmed}
          />
        </View>
      </View>

      {/* ═══════════════════════════════════════════
          SECTION 5 · LOGISTICS
      ═══════════════════════════════════════════ */}
      <View style={styles.card}>
        <SectionHeader num={5} title="Logistics" color="#7A7669" iconBg="#F9F8F5" />
        <View style={styles.cardBody}>
          <Note>Transport and movement details for this supply chain leg.</Note>

          <Field label="Carrier / Logistics Company" required error={errors.carrierName}>
            <Input
              value={carrierName}
              onChangeText={v => { setCarrierName(v); clear('carrierName')(v); }}
              placeholder="e.g. Siginon Logistics, Own Transport"
              error={errors.carrierName}
            />
          </Field>

          <SelectRow
            label="Transport Mode" required
            value={transportMode}
            options={TRANSPORT_MODES}
            onSelect={v => { setTransportMode(v); clear('transportMode')(v); }}
            error={errors.transportMode}
          />

          <Field label="Origin Location" required error={errors.originLocation}>
            <Input
              value={originLocation}
              onChangeText={v => { setOriginLocation(v); clear('originLocation')(v); }}
              placeholder="e.g. Kisumu Cold Storage, Kondele"
              error={errors.originLocation}
            />
          </Field>
          <Field label="Destination" required error={errors.destinationLocation}>
            <Input
              value={destinationLocation}
              onChangeText={v => { setDestinationLocation(v); clear('destinationLocation')(v); }}
              placeholder="e.g. Nairobi City Market, Gikomba"
              error={errors.destinationLocation}
            />
          </Field>

          <View style={styles.twoCol}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Dispatch Date & Time">
                <Input
                  value={dispatchDatetime}
                  onChangeText={setDispatchDatetime}
                  placeholder="YYYY-MM-DD HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Est. Delivery">
                <Input
                  value={estimatedDelivery}
                  onChangeText={setEstimatedDelivery}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
              </Field>
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Tracking / Waybill No.">
                <Input
                  value={trackingNumber}
                  onChangeText={setTrackingNumber}
                  placeholder="e.g. SGNK-20250529-007"
                  autoCapitalize="characters"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Vehicle Plate">
                <Input
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                  placeholder="e.g. KDA 123B"
                  autoCapitalize="characters"
                />
              </Field>
            </View>
          </View>

          <Field label="Driver / Handler Name">
            <Input value={driverName} onChangeText={setDriverName} placeholder="Full name of driver or handler" />
          </Field>
          <Field label="Logistics Notes">
            <Input
              value={logisticsNotes}
              onChangeText={setLogisticsNotes}
              placeholder="Route taken, delays, border crossings, storage stops…"
              multiline
              numberOfLines={4}
            />
          </Field>

          <CheckRow label="Goods are insured for this transit leg" value={insuranceCovered} onChange={setInsuranceCovered} />
          <CheckRow label="Customs / border clearance completed" value={customsCleared} onChange={setCustomsCleared} />
        </View>
      </View>

      {/* ═══════════════════════════════════════════
          SUBMIT
      ═══════════════════════════════════════════ */}
      <View style={styles.submitCard}>
        <CheckRow
          label="I confirm all the information in this form is accurate and I authorise recording this event on the TraceBlocks supply chain ledger."
          value={finalConfirm}
          onChange={v => { setFinalConfirm(v); if (v) setErrors(p => { const e={...p}; delete e.finalConfirm; return e; }); }}
          error={errors.finalConfirm}
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>⬡  Submit to TraceBlocks</Text>}
        </TouchableOpacity>

        <Text style={styles.footer}>Event will be recorded immutably on VeChainThor</Text>
      </View>

    </ScrollView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EE' },
  inner:     { paddingBottom: 60 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1A2E22',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backText: { color: 'rgba(208,235,224,0.7)', fontSize: 14 },
  topTitle: { color: '#E8F4EE', fontSize: 16, fontWeight: '600' },

  pageHeader:    { padding: 20, paddingBottom: 8 },
  eventIdRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  eventIdLabel:  { fontSize: 11, fontWeight: '600', color: '#7A7669', textTransform: 'uppercase', letterSpacing: 0.7 },
  eventIdInput:  {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12, color: '#2D6A4F',
    backgroundColor: '#E8F4EE', borderWidth: 1, borderColor: '#B5D9C8',
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, flex: 1,
  },
  pageTitle:    { fontSize: 28, fontWeight: '300', color: '#1C1A17', letterSpacing: -0.5, lineHeight: 34, marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: '#7A7669', lineHeight: 20 },

  gpsStrip:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 8,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  gpsStripOk: { backgroundColor: '#E8F4EE', borderColor: '#B5D9C8' },
  gpsDot:     { fontSize: 10, color: '#A8A49A' },
  gpsText:    { fontSize: 11, color: '#7A7669', flex: 1, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  gpsTextOk:  { color: '#2D6A4F' },

  // error banner
  errorBanner: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#FDEAEA', borderWidth: 1, borderColor: '#EFC0C0',
    borderRadius: 10, padding: 14,
  },
  errorBannerTitle: { fontSize: 13, fontWeight: '700', color: '#A12B2B', marginBottom: 4 },
  errorBannerBody:  { fontSize: 12, color: '#A12B2B', lineHeight: 18 },

  // cards
  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 14, marginHorizontal: 16, marginTop: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9F8F5', borderBottomWidth: 1, borderBottomColor: '#E2DED6',
    borderLeftWidth: 3, paddingHorizontal: 16, paddingVertical: 14,
  },
  sectionNumBadge: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionNumText:  { fontSize: 14, fontWeight: '700' },
  sectionNumLabel: { fontSize: 10, color: '#A8A49A', fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionTitle:    { fontSize: 15, color: '#1C1A17', fontWeight: '600' },
  cardBody:        { padding: 16 },

  // fields
  fieldWrap:  { marginBottom: 14 },
  label: {
    fontSize: 10, fontWeight: '700', color: '#7A7669',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  req:        { color: '#B5653A' },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCC9BF',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#1C1A17',
  },
  inputError: { borderColor: '#C0392B', backgroundColor: '#FFF8F8' },
  textarea:   { minHeight: 80, textAlignVertical: 'top' },
  fieldError: { fontSize: 11, color: '#C0392B', marginTop: 4, fontWeight: '500' },
  fieldHint:  { fontSize: 11, color: '#A8A49A', marginTop: 4 },

  // select
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CCC9BF',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
  },
  selectText:    { fontSize: 14, color: '#1C1A17', flex: 1 },
  selectChevron: { fontSize: 10, color: '#A8A49A', marginLeft: 6 },
  selectDropdown: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  selectOption:           { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0EDE7' },
  selectOptionActive:     { backgroundColor: '#E8F4EE' },
  selectOptionText:       { fontSize: 14, color: '#1C1A17' },
  selectOptionTextActive: { color: '#2D6A4F', fontWeight: '600' },

  // checkboxes
  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F9F8F5', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  checkRowError: { borderColor: '#C0392B', backgroundColor: '#FFF8F8' },
  checkbox:      {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#CCC9BF',
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { backgroundColor: '#2D6A4F', borderColor: '#2D6A4F' },
  checkmark:      { color: '#fff', fontSize: 11, fontWeight: '700' },
  checkLabel:     { fontSize: 13, color: '#1C1A17', lineHeight: 20, flex: 1 },

  expandableBody: {
    backgroundColor: '#F9F8F5', borderRadius: 10,
    borderWidth: 1, borderColor: '#E2DED6', borderStyle: 'dashed',
    padding: 14, marginTop: 4, marginBottom: 10,
  },

  twoCol:   { flexDirection: 'row', alignItems: 'flex-start' },
  divider:  { borderTopWidth: 1, borderTopColor: '#E2DED6', marginVertical: 20 },
  subLabel: {
    fontSize: 11, fontWeight: '700', color: '#7A7669',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  note:     {
    backgroundColor: '#F9F8F5', borderLeftWidth: 3, borderLeftColor: '#CCC9BF',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
  },
  noteText: { fontSize: 13, color: '#7A7669', lineHeight: 19 },

  submitCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2DED6',
    borderRadius: 14, margin: 16, marginTop: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  submitBtn:         { marginTop: 16, backgroundColor: '#2D6A4F', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer:            { textAlign: 'center', color: '#A8A49A', fontSize: 11, marginTop: 12 },
});