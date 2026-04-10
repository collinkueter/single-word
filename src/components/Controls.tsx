import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReaderStore } from '../store/useReaderStore';

export const Controls: React.FC = () => {
  const { fontSize, setFontSize, theme } = useReaderStore();

  const isDark = theme === 'dark';
  const colors = {
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6D6D72',
    border: isDark ? '#38383A' : '#E5E5EA',
    btn: isDark ? '#2C2C2E' : '#F2F2F7',
  };

  const handleFontSize = (delta: number) => {
    setFontSize(Math.max(20, Math.min(72, fontSize + delta)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.secondary }]}>Font Size</Text>
        <View style={styles.stepperGroup}>
          <Pressable
            style={[styles.stepperBtn, { backgroundColor: colors.btn }]}
            onPress={() => handleFontSize(-4)}
            hitSlop={8}
            accessibilityLabel="Decrease font size"
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>A−</Text>
          </Pressable>
          <Text style={[styles.stepperValue, { color: colors.text }]}>{fontSize}</Text>
          <Pressable
            style={[styles.stepperBtn, { backgroundColor: colors.btn }]}
            onPress={() => handleFontSize(4)}
            hitSlop={8}
            accessibilityLabel="Increase font size"
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>A+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'center',
  },
});
