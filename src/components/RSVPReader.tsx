import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Voice } from 'expo-speech';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';
import { useReaderStore } from '../store/useReaderStore';
import { ORPDisplay } from './ORPDisplay';
import {
  segmentIntoSentences,
  findSentenceForIndex,
  charIndexToWordIndex,
  speakSentence,
  stopSpeech,
  isWpmTooFastForSpeech,
  getAvailableVoices,
  MAX_READ_ALOUD_WPM,
} from '../utils/speech';

interface RSVPReaderProps {
  onFinished?: () => void;
}

export const RSVPReader: React.FC<RSVPReaderProps> = ({ onFinished }) => {
  const { words, currentIndex, setCurrentIndex, wpm, setWPM, theme, fontSize, readAloudEnabled, setReadAloudEnabled, selectedVoice, isDemo } = useReaderStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [localIndex, setLocalIndex] = useState(currentIndex);
  const [finished, setFinished] = useState(false);
  const speechCancelledRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);
  const [actualReadTimeMs, setActualReadTimeMs] = useState<number | null>(null);

  const sentences = useMemo(() => segmentIntoSentences(words), [words]);

  // When read-aloud is active, speech boundary events drive the visual index
  const speechDrivesVisual = readAloudEnabled && !isWpmTooFastForSpeech(wpm);

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
  const sharedSpeechDrives = useSharedValue(speechDrivesVisual);
  const lastUpdateTimestamp = useSharedValue(0);

  useEffect(() => {
    sharedIndex.value = currentIndex;
    setLocalIndex(currentIndex);
    // Only clear the finished state on an external rewind/reset — not when we
    // just finished and synced the last index back to the store.
    if (currentIndex < words.length - 1) {
      setFinished(false);
    }
  }, [currentIndex, sharedIndex, words.length]);

  const sharedIsDemo = useSharedValue(isDemo);

  useEffect(() => {
    sharedWpm.value = wpm;
  }, [wpm, sharedWpm]);

  useEffect(() => {
    sharedIsDemo.value = isDemo;
  }, [isDemo, sharedIsDemo]);

  useEffect(() => {
    sharedSpeechDrives.value = speechDrivesVisual;
  }, [speechDrivesVisual, sharedSpeechDrives]);

  const onIndexChange = (index: number) => {
    setLocalIndex(index);
  };

  // Start speaking from the sentence containing the given word index
  const startSpeechFrom = useCallback(
    async (fromWordIndex: number) => {
      if (!readAloudEnabled || isWpmTooFastForSpeech(wpm)) return;
      speechCancelledRef.current = false;
      isSpeakingRef.current = true;

      let sentIdx = findSentenceForIndex(sentences, fromWordIndex);
      while (sentIdx < sentences.length && !speechCancelledRef.current) {
        const sentence = sentences[sentIdx];
        await speakSentence({
          text: sentence.text,
          wpm,
          voice: selectedVoice ?? undefined,
          onBoundary: (charIndex) => {
            const wordIdx = charIndexToWordIndex(sentence, charIndex);
            sharedIndex.value = wordIdx;
            setLocalIndex(wordIdx);
          },
        });
        sentIdx++;
      }
      isSpeakingRef.current = false;

      // If we finished all sentences without being cancelled, trigger completion
      if (!speechCancelledRef.current && sentIdx >= sentences.length) {
        sharedIndex.value = words.length - 1;
        setLocalIndex(words.length - 1);
        sharedIsPlaying.value = false;
        onPlaybackEnd();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readAloudEnabled, wpm, sentences, selectedVoice, sharedIndex, words.length, sharedIsPlaying]
  );

  const stopSpeechPlayback = useCallback(() => {
    speechCancelledRef.current = true;
    stopSpeech();
    isSpeakingRef.current = false;
  }, []);

  const onPlaybackEnd = () => {
    const now = Date.now();
    const sessionMs = startTimeRef.current ? (now - startTimeRef.current) : 0;
    const totalMs = elapsedBeforePauseRef.current + sessionMs;
    setActualReadTimeMs(totalMs);
    startTimeRef.current = null;
    elapsedBeforePauseRef.current = 0;
    setIsPlaying(false);
    setFinished(true);
    setCurrentIndex(sharedIndex.value);
    stopSpeechPlayback();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onFinished?.();
  };

  useFrameCallback(({ timestamp }) => {
    if (!sharedIsPlaying.value || words.length === 0) {
      lastUpdateTimestamp.value = 0;
      return;
    }

    // When speech drives the visual, skip timer-based advancement
    if (sharedSpeechDrives.value) return;

    if (lastUpdateTimestamp.value === 0) {
      lastUpdateTimestamp.value = timestamp;
      return;
    }

    const currentWord = words[Math.min(sharedIndex.value, words.length - 1)];
    if (!currentWord) return;

    const effectiveWpm = (sharedIsDemo.value && currentWord.targetWpm) ? currentWord.targetWpm : sharedWpm.value;
    const baseInterval = 60000 / effectiveWpm;
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

  const rewindToBeginning = useCallback(() => {
    sharedIndex.value = 0;
    setLocalIndex(0);
    setCurrentIndex(0);
    setFinished(false);
    setActualReadTimeMs(null);
    startTimeRef.current = null;
    elapsedBeforePauseRef.current = 0;
    if (isPlaying) {
      stopSpeechPlayback();
      sharedIsPlaying.value = false;
      setIsPlaying(false);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [sharedIndex, setCurrentIndex, isPlaying, stopSpeechPlayback, sharedIsPlaying]);

  const togglePlay = useCallback(() => {
    if (finished) {
      // Restart from beginning
      sharedIndex.value = 0;
      setLocalIndex(0);
      setCurrentIndex(0);
      setFinished(false);
      setActualReadTimeMs(null);
      startTimeRef.current = Date.now();
      elapsedBeforePauseRef.current = 0;
      sharedIsPlaying.value = true;
      setIsPlaying(true);
      startSpeechFrom(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    const nextValue = !isPlaying;
    setIsPlaying(nextValue);
    sharedIsPlaying.value = nextValue;

    if (nextValue) {
      startTimeRef.current = Date.now();
      startSpeechFrom(sharedIndex.value);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Accumulate elapsed time on pause
      if (startTimeRef.current) {
        elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
        startTimeRef.current = null;
      }
      stopSpeechPlayback();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentIndex(sharedIndex.value);
    }
  }, [isPlaying, finished, sharedIndex, sharedIsPlaying, setCurrentIndex, startSpeechFrom, stopSpeechPlayback]);

  const skip = useCallback(
    (delta: number) => {
      const newIndex = Math.max(0, Math.min(words.length - 1, sharedIndex.value + delta));
      sharedIndex.value = newIndex;
      setLocalIndex(newIndex);
      setCurrentIndex(newIndex);
      if (finished) setFinished(false);
      if (isSpeakingRef.current) {
        stopSpeechPlayback();
        startSpeechFrom(newIndex);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [words.length, sharedIndex, setCurrentIndex, finished, stopSpeechPlayback, startSpeechFrom]
  );

  const handleWPM = useCallback(
    (delta: number) => {
      const newWpm = Math.max(50, Math.min(1500, wpm + delta));
      setWPM(newWpm);
      if (readAloudEnabled && isWpmTooFastForSpeech(newWpm)) {
        stopSpeechPlayback();
        setReadAloudEnabled(false);
        Alert.alert('Read Aloud Disabled', `Speech is unavailable above ${MAX_READ_ALOUD_WPM} WPM`);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [wpm, setWPM, readAloudEnabled, setReadAloudEnabled, stopSpeechPlayback]
  );

  const toggleReadAloud = useCallback(() => {
    if (!readAloudEnabled && isWpmTooFastForSpeech(wpm)) {
      Alert.alert('Speed Too High', `Read aloud is unavailable above ${MAX_READ_ALOUD_WPM} WPM. Lower your speed first.`);
      return;
    }
    const next = !readAloudEnabled;
    setReadAloudEnabled(next);
    if (!next) {
      stopSpeechPlayback();
    } else if (isPlaying) {
      startSpeechFrom(sharedIndex.value);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [readAloudEnabled, wpm, setReadAloudEnabled, stopSpeechPlayback, isPlaying, startSpeechFrom, sharedIndex]);

  const { setSelectedVoice } = useReaderStore();

  const showVoicePicker = useCallback(async () => {
    const voices = await getAvailableVoices();
    // Filter to English voices and sort by quality
    const englishVoices = voices
      .filter((v: Voice) => v.language.startsWith('en'))
      .sort((a: Voice, b: Voice) => {
        if (a.quality !== b.quality) return a.quality === 'Enhanced' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    if (englishVoices.length === 0) {
      Alert.alert('No Voices', 'No English voices available on this device.');
      return;
    }

    const options = ['System Default', ...englishVoices.map((v: Voice) => `${v.name}${v.quality === 'Enhanced' ? ' (Enhanced)' : ''}`)];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options, 'Cancel'], cancelButtonIndex: options.length, title: 'Select Voice' },
        (index) => {
          if (index === options.length) return;
          if (index === 0) {
            setSelectedVoice(null);
          } else {
            setSelectedVoice(englishVoices[index - 1].identifier);
          }
        }
      );
    } else {
      // Android fallback: simple alert with first few voices
      const voiceList = options.slice(0, 10).join('\n');
      Alert.alert('Available Voices', voiceList);
    }
  }, [setSelectedVoice]);

  if (words.length === 0) return null;

  const progress = words.length > 1 ? localIndex / (words.length - 1) : 0;
  const currentWord = words[Math.min(localIndex, words.length - 1)];
  const currentTargetWpm = (isDemo && currentWord?.targetWpm) ? currentWord.targetWpm : wpm;
  const timeRemaining = Math.max(0, Math.ceil((words.length - localIndex) / currentTargetWpm));

  // Time comparison calculations
  const avgReadTimeSec = Math.round((words.length / 250) * 60);
  const actualReadTimeSec = actualReadTimeMs ? Math.round(actualReadTimeMs / 1000) : null;
  const timeSavedSec = actualReadTimeSec !== null ? Math.max(0, avgReadTimeSec - actualReadTimeSec) : null;

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

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
            {actualReadTimeSec !== null && (
              <View style={styles.timeStats}>
                <View style={styles.timeRow}>
                  <Text style={[styles.timeLabel, { color: colors.secondary }]}>Average reader (250 WPM)</Text>
                  <Text style={[styles.timeValue, { color: colors.secondary }]}>{formatDuration(avgReadTimeSec)}</Text>
                </View>
                <View style={styles.timeRow}>
                  <Text style={[styles.timeLabel, { color: colors.text }]}>Your time</Text>
                  <Text style={[styles.timeValue, { color: colors.text }]}>{formatDuration(actualReadTimeSec)}</Text>
                </View>
                {timeSavedSec !== null && timeSavedSec > 0 && (
                  <View style={[styles.timeSavedRow, { backgroundColor: isDark ? '#1A3A1A' : '#E8F5E9' }]}>
                    <Text style={[styles.timeSavedText, { color: '#4CAF50' }]}>
                      You saved {formatDuration(timeSavedSec)}
                    </Text>
                  </View>
                )}
              </View>
            )}
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
            {isDemo && currentWord?.targetWpm ? currentWord.targetWpm : wpm} <Text style={[styles.wpmUnit, { color: colors.secondary }]}>WPM</Text>
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
            style={[styles.rewindBtn, { backgroundColor: colors.btn }]}
            onPress={rewindToBeginning}
            accessibilityLabel="Rewind to beginning"
            hitSlop={8}
          >
            <Ionicons name="play-skip-back" size={16} color={colors.btnText} />
          </Pressable>

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

          <Pressable
            style={[styles.rewindBtn, { backgroundColor: readAloudEnabled ? colors.accent : colors.btn }]}
            onPress={toggleReadAloud}
            onLongPress={showVoicePicker}
            accessibilityLabel={readAloudEnabled ? 'Disable read aloud' : 'Enable read aloud'}
            accessibilityHint="Long press to change voice"
            hitSlop={8}
          >
            <Ionicons
              name={readAloudEnabled ? 'volume-high' : 'volume-mute'}
              size={20}
              color={readAloudEnabled ? '#FFFFFF' : colors.btnText}
            />
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
  timeStats: {
    width: '100%',
    paddingHorizontal: 40,
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  timeSavedRow: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  timeSavedText: {
    fontSize: 15,
    fontWeight: '700',
  },
  finishedSub: {
    fontSize: 15,
    marginTop: 4,
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
  rewindBtn: {
    height: 48,
    width: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
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
