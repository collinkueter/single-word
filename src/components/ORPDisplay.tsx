import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { WordObject } from '../utils/text-parsing';

interface ORPDisplayProps {
  word: WordObject;
  fontSize: number;
  theme: 'light' | 'dark';
}

export const ORPDisplay: React.FC<ORPDisplayProps> = ({ word, fontSize, theme }) => {
  const { text, orpIndex } = word;
  const { width: screenWidth } = useWindowDimensions();

  // Scale down font if the word would overflow. Available width = screen minus
  // wordRow paddingHorizontal (20×2) and a small safety margin (20).
  const availableWidth = screenWidth - 60;
  
  // Calculate how many characters we need to fit on either side of the ORP
  // to keep it centered. The total "virtual" length is 2 * maxSide + 1.
  const maxSideChars = Math.max(orpIndex, text.length - 1 - orpIndex);
  const virtualLength = maxSideChars * 2 + 1;
  
  const estimatedWordWidth = virtualLength * fontSize * 0.62;
  const effectiveFontSize =
    estimatedWordWidth > availableWidth
      ? Math.floor(availableWidth / (virtualLength * 0.62))
      : fontSize;

  const prefix = text.substring(0, orpIndex);
  const orpLetter = text.substring(orpIndex, orpIndex + 1);
  const suffix = text.substring(orpIndex + 1);

  // Use equal flex for both sides to ensure the ORP (red letter) stays centered.
  // We handle potential overflows by scaling the font size instead.
  const prefixFlex = 1;
  const suffixFlex = 1;

  const textColor = theme === 'dark' ? '#FFFFFF' : '#000000';
  const orpColor = '#FF3B30';

  return (
    <View style={styles.container}>
      {/* Subtle vertical guide line at ORP position */}
      <View style={[styles.guideTop, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#D1D1D6' }]} />
      <View style={[styles.guideBottom, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#D1D1D6' }]} />

      <View style={styles.wordRow}>
        <View style={[styles.prefixContainer, { flex: prefixFlex }]}>
          <Text
            style={[styles.wordText, { fontSize: effectiveFontSize, color: textColor, textAlign: 'right' }]}
            numberOfLines={1}
          >
            {prefix}
          </Text>
        </View>

        <View style={styles.orpContainer}>
          <Text style={[styles.wordText, styles.orpLetter, { fontSize: effectiveFontSize, color: orpColor }]}>
            {orpLetter}
          </Text>
        </View>

        <View style={[styles.suffixContainer, { flex: suffixFlex }]}>
          <Text
            style={[styles.wordText, { fontSize: effectiveFontSize, color: textColor, textAlign: 'left' }]}
            numberOfLines={1}
          >
            {suffix}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  prefixContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  orpContainer: {
    alignItems: 'center',
    minWidth: 8,
  },
  suffixContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  wordText: {
    includeFontPadding: false,
    letterSpacing: 0.5,
  },
  orpLetter: {
    fontWeight: '700',
  },
  guideTop: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -1,
    width: 2,
    height: 14,
    borderRadius: 1,
  },
  guideBottom: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -1,
    width: 2,
    height: 14,
    borderRadius: 1,
  },
});
