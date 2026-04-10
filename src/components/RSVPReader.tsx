import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';
import { useReaderStore } from '../store/useReaderStore';
import { ORPDisplay } from './ORPDisplay';

interface RSVPReaderProps {
  onFinished?: () => void;
}

export const RSVPReader: React.FC<RSVPReaderProps> = ({ onFinished }) => {
  const { words, currentIndex, setCurrentIndex, wpm, setWPM, theme, fontSize } = useReaderStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [localIndex, setLocalIndex] = useState(currentIndex);
  const [finished, setFinished] = useState(false);

  const isDark = theme === 'dark';
  const colors = {
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6D6D72',
    surface: isDark ? '#1C1C1E' : '#F2F2F7',
    accent: '#FF3B30',
    border: isDark ? '#38383A' : '#E5E5EA',
    progressBg: isDark ? '#2C2C2E' : '#E5E5EA',
    btn: isDark ? '#2C2C2E' : '#F2F2F7',
    btnText: isDark ? '#FFFFFF' : '#000000',
  };

  // Reanimated shared values for UI-thread playback engine
  const sharedIndex = useSharedValue(currentIndex);
  const sharedIsPlaying = useSharedValue(false);
  const sharedWpm = useSharedValue(wpm);
  const lastUpdateTimestamp = useSharedValue(0);

  useEffect(() => {
    sharedIndex.value = currentIndex;
    setLocalIndex(currentIndex);
    setFinished(false);
  }, [currentIndex, sharedIndex]);

  useEffect(() => {
    sharedWpm.value = wpm;
  }, [wpm, sharedWpm]);

  const onIndexChange = (index: number) => {
    setLocalIndex(index);
  };

  const onPlaybackEnd = () => {
    setIsPlaying(false);
    setFinished(true);
    setCurrentIndex(sharedIndex.value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onFinished?.();
  };

  useFrameCallback(({ timestamp }) => {
    if (!sharedIsPlaying.value || words.length === 0) {
      lastUpdateTimestamp.value = 0;
      return;
    }

    if (lastUpdateTimestamp.value === 0) {
      lastUpdateTimestamp.value = timestamp;
      return;
    }

    const currentWord = words[Math.min(sharedIndex.value, words.length - 1)];
    if (!currentWord) return;

    const baseInterval = 60000 / sharedWpm.value;
    const interval = baseInterval * (currentWord.delayMultiplier ?? 1.0);

    if (timestamp - lastUpdateTimestamp.value >= interval) {
      if (sharedIndex.value < words.length - 1) {
        sharedIndex.value += 1;
        lastUpdateTimestamp.value = timestamp;
        runOnJS(onIndexChange)(sharedIndex.value);
      } else {
        sharedIsPlaying.value = false;
        runOnJS(onPlaybackEnd)();
      }
    }
  });

  const togglePlay = useCallback(() => {
    if (finished) {
      // Restart from beginning
      sharedIndex.value = 0;
      setLocalIndex(0);
      setCurrentIndex(0);
      setFinished(false);
      sharedIsPlaying.value = true;
      setIsPlaying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    const nextValue = !isPlaying;
    setIsPlaying(nextValue);
    sharedIsPlaying.value = nextValue;

    if (nextValue) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentIndex(sharedIndex.value);
    }
  }, [isPlaying, finished, sharedIndex, sharedIsPlaying, setCurrentIndex]);

  const skip = useCallback(
    (delta: number) => {
      const newIndex = Math.max(0, Math.min(words.length - 1, sharedIndex.value + delta));
      sharedIndex.value = newIndex;
      setLocalIndex(newIndex);
      setCurrentIndex(newIndex);
      if (finished) setFinished(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [words.length, sharedIndex, setCurrentIndex, finished]
  );

  const handleWPM = useCallback(
    (delta: number) => {
      setWPM(Math.max(50, Math.min(1500, wpm + delta)));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [wpm, setWPM]
  );

  if (words.length === 0) return null;

  const progress = words.length > 1 ? localIndex / (words.length - 1) : 0;
  const timeRemaining = Math.max(0, Math.ceil((words.length - localIndex) / wpm));
  const currentWord = words[Math.min(localIndex, words.length - 1)];

  const playIcon: React.ComponentProps<typeof Ionicons>['name'] = finished
    ? 'refresh'
    : isPlaying
    ? 'pause'
    : 'play';

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.progressBg }]}>
        <Animated.View
          style={[
            styles.progressFill,
            { backgroundColor: colors.accent, width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>

      {/* Progress Label */}
      <View style={styles.progressLabel}>
        <Text style={[styles.progressText, { color: colors.secondary }]}>
          {Math.round(progress * 100)}%
        </Text>
        <Text style={[styles.progressText, { color: colors.secondary }]}>
          {timeRemaining > 0 ? `${timeRemaining} min left` : 'Done'}
        </Text>
      </View>

      {/* Word Display — tap to play/pause */}
      <Pressable style={styles.wordArea} onPress={togglePlay} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
        {finished ? (
          <View style={styles.finishedContainer}>
            <Text style={[styles.finishedText, { color: colors.text }]}>Finished!</Text>
            <Text style={[styles.finishedSub, { color: colors.secondary }]}>
              Tap to read again
            </Text>
          </View>
        ) : (
          <ORPDisplay word={currentWord} fontSize={fontSize} theme={theme} />
        )}
      </Pressable>

      {/* Playback Controls */}
      <View style={styles.controls}>
        {/* WPM row */}
        <View style={styles.wpmRow}>
          <Pressable
            style={[styles.wpmBtn, { backgroundColor: colors.btn }]}
            onPress={() => handleWPM(-25)}
            accessibilityLabel="Decrease speed"
            hitSlop={8}
          >
            <Text style={[styles.wpmBtnText, { color: colors.btnText }]}>−25</Text>
          </Pressable>

          <Text style={[styles.wpmDisplay, { color: colors.text }]}>
            {wpm} <Text style={[styles.wpmUnit, { color: colors.secondary }]}>WPM</Text>
          </Text>

          <Pressable
            style={[styles.wpmBtn, { backgroundColor: colors.btn }]}
            onPress={() => handleWPM(25)}
            accessibilityLabel="Increase speed"
            hitSlop={8}
          >
            <Text style={[styles.wpmBtnText, { color: colors.btnText }]}>+25</Text>
          </Pressable>
        </View>

        {/* Skip + Play row */}
        <View style={styles.playRow}>
          <Pressable
            style={[styles.skipBtn, { backgroundColor: colors.btn }]}
            onPress={() => skip(-10)}
            accessibilityLabel="Skip back 10 words"
            hitSlop={8}
          >
            <Ionicons name="play-back" size={16} color={colors.btnText} />
            <Text style={[styles.skipLabel, { color: colors.btnText }]}>10</Text>
          </Pressable>

          <Pressable
            style={[styles.playBtn, { backgroundColor: colors.accent }]}
            onPress={togglePlay}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Ionicons name={playIcon} size={32} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[styles.skipBtn, { backgroundColor: colors.btn }]}
            onPress={() => skip(10)}
            accessibilityLabel="Skip forward 10 words"
            hitSlop={8}
          >
            <Text style={[styles.skipLabel, { color: colors.btnText }]}>10</Text>
            <Ionicons name="play-forward" size={16} color={colors.btnText} />
          </Pressable>
        </View>

        {/* Word position */}
        <Text style={[styles.wordPosition, { color: colors.secondary }]}>
          {localIndex + 1} / {words.length}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  wordArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishedContainer: {
    alignItems: 'center',
    gap: 8,
  },
  finishedText: {
    fontSize: 32,
    fontWeight: '700',
  },
  finishedSub: {
    fontSize: 15,
  },
  controls: {
    paddingBottom: 8,
    paddingHorizontal: 20,
    gap: 12,
  },
  wpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wpmBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  wpmBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  wpmDisplay: {
    fontSize: 28,
    fontWeight: '700',
  },
  wpmUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  skipBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
    gap: 6,
  },
  skipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  wordPosition: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
  },
});
