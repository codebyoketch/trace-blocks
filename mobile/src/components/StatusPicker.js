import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  FlatList, StyleSheet,
} from 'react-native';

const STATUS_CHOICES = [
  { value: 'manufactured',     label: 'Manufactured' },
  { value: 'shipped',          label: 'Shipped' },
  { value: 'in_transit',       label: 'In Transit' },
  { value: 'at_hub',           label: 'At Hub' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered',        label: 'Delivered' },
  { value: 'handover',         label: 'Handover' },
];

export default function StatusPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = STATUS_CHOICES.find((s) => s.value === value);

  return (
    <View>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.triggerText : styles.placeholder}>
          {selected ? selected.label : 'Select status…'}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Status</Text>
            <FlatList
              data={STATUS_CHOICES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <Text style={styles.check}>✓</Text>
                  )}
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
  trigger: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: '#F9F8F5',
    borderWidth:     1,
    borderColor:     '#CCC9BF',
    borderRadius:    10,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  triggerText: { fontSize: 14, color: '#1C1A17', fontWeight: '500' },
  placeholder: { fontSize: 14, color: '#A8A49A' },
  arrow:       { fontSize: 14, color: '#7A7669' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  sheetTitle: {
    fontSize:    13,
    fontWeight:  '700',
    color:       '#7A7669',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign:   'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2DED6',
  },
  option: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F3EE',
  },
  optionSelected: { backgroundColor: '#E8F4EE' },
  optionText:         { fontSize: 15, color: '#1C1A17' },
  optionTextSelected: { color: '#2D6A4F', fontWeight: '600' },
  check: { color: '#2D6A4F', fontWeight: '700', fontSize: 16 },
});