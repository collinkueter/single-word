import React, { useRef, useEffect } from 'react';
import { ScrollView, Text, StyleSheet, Pressable, View } from 'react-native';
import { useReaderStore } from '../store/useReaderStore';

interface TraditionalReaderProps {
  onWordPress?: () => void;
}

export const TraditionalReader: React.FC<TraditionalReaderProps> = ({ onWordPress }) => {
  const { words, currentIndex, setCurrentIndex, theme, fontSize } = useReaderStore();
  const scrollRef = useRef<ScrollView>(null);

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#000000' : '#FFFFFF',
    text: isDark ? '#AEAEB2' : '#555555',
    activeText: isDark ? '#FFFFFF' : '#000000',
    accent: '#FF3B30',
  };

  useEffect(() => {
    // Scroll to keep the current word visible
    if (currentIndex > 0 && scrollRef.current) {
      const lineHeight = fontSize * 1.8;
      const wordsPerLine = 8;
      const approxLine = Math.floor(currentIndex / wordsPerLine);
      scrollRef.current.scrollTo({ y: Math.max(0, (approxLine - 2) * lineHeight), animated: true });
    }
  }, [currentIndex, fontSize]);

  const handlePress = (index: number) => {
    setCurrentIndex(index);
    onWordPress?.();
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.hint, { color: colors.text }]}>
        Tap a word to jump to it in speed mode
      </Text>
      <View style={styles.textWrapper}>
        {words.map((word, index) => {
          const isActive = index === currentIndex;
          const isPast = index < currentIndex;
          return (
            <Pressable
              key={index}
              onPress={() => handlePress(index)}
              style={[styles.wordContainer, isActive && styles.activeWordContainer]}
            >
              <Text
                style={[
                  styles.wordText,
                  {
                    fontSize: fontSize * 0.65,
                    color: isActive ? colors.activeText : isPast ? colors.accent : colors.text,
                    fontWeight: isActive ? '700' : isPast ? '600' : '400',
                  },
                ]}
              >
                {word.text}
              </Text>
              {isActive && (
                <View style={[styles.activeUnderline, { backgroundColor: colors.accent }]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  textWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wordContainer: {
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  activeWordContainer: {
    backgroundColor: 'transparent',
  },
  wordText: {
    lineHeight: undefined,
  },
  activeUnderline: {
    height: 2,
    width: '100%',
    borderRadius: 1,
    marginTop: 2,
  },
});
