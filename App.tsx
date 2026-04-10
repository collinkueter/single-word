import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useReaderStore } from './src/store/useReaderStore';
import { RSVPReader } from './src/components/RSVPReader';
import { TraditionalReader } from './src/components/TraditionalReader';
import { Controls } from './src/components/Controls';
import { extractTextFromUrl } from './src/utils/web-extractor';
import { FeedbackModal } from './src/components/FeedbackModal';

const SAMPLE_TEXT =
  'The science of speed reading is fascinating. Traditional reading forces your eyes to jump across the page in a series of movements called saccades. These movements consume significant mental energy and slow you down. Speed reading using RSVP — Rapid Serial Visual Presentation — eliminates eye movement entirely. Words come to you at a fixed focal point, one by one. Your brain processes each word instantly without searching for it. With practice, readers consistently achieve 400 to 600 words per minute. The average person reads around 250 words per minute. By training your focus and reducing subvocalization, you can double or even triple your reading speed while maintaining full comprehension of the text.';

type ReadMode = 'rsvp' | 'full';

export default function App() {
  const { rawText, setText, words, theme, setTheme } = useReaderStore();
  const [inputText, setInputText] = useState(rawText);
  const [readMode, setReadMode] = useState<ReadMode>('rsvp');
  const [urlInput, setUrlInput] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(null);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  const isDark = theme === 'dark';

  const colors = {
    bg: isDark ? '#000000' : '#FFFFFF',
    surface: isDark ? '#1C1C1E' : '#F2F2F7',
    inputBg: isDark ? '#2C2C2E' : '#FFFFFF',
    inputBorder: isDark ? '#636366' : '#C7C7CC',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6D6D72',
    accent: '#FF3B30',
    border: isDark ? '#38383A' : '#E5E5EA',
    placeholder: isDark ? '#8E8E93' : '#AEAEB2',
  };

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;
  const estimatedMin = wordCount > 0 ? Math.ceil(wordCount / 250) : 0;

  const handleStart = () => {
    if (inputText.trim()) setText(inputText.trim());
  };

  const handleBack = () => {
    setText('');
    setReadMode('rsvp');
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim() || isFetching) return;
    setIsFetching(true);
    setFetchError(null);
    setFetchedTitle(null);
    try {
      const result = await extractTextFromUrl(urlInput.trim());
      setInputText(result.text);
      setFetchedTitle(result.title);
      setCurrentUrl(urlInput.trim());
      setUrlInput('');
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setIsFetching(false);
    }
  };

  // ─── HOME SCREEN ────────────────────────────────────────────────────────────
  if (words.length === 0) {
    return (
      <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.flex}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex}
          >
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.homeContainer}>
                  {/* Header */}
                  <View style={styles.homeHeader}>
                    <View style={styles.homeHeaderRow}>
                      <View style={styles.titleRow}>
                        <Text style={[styles.titleMain, { color: colors.text }]}>Single</Text>
                        <Text style={[styles.titleAccent, { color: colors.accent }]}> Word</Text>
                      </View>
                      <Pressable
                        onPress={() => setTheme(isDark ? 'light' : 'dark')}
                        hitSlop={12}
                        accessibilityLabel="Toggle dark mode"
                      >
                        <Ionicons
                          name={isDark ? 'sunny-outline' : 'moon-outline'}
                          size={22}
                          color={colors.secondary}
                        />
                      </Pressable>
                    </View>
                    <Text style={[styles.subtitle, { color: colors.secondary }]}>
                      Read faster. Understand more.
                    </Text>
                  </View>

                  {/* URL import card */}
                  <View style={styles.urlSection}>
                    <View
                      style={[
                        styles.urlCard,
                        { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                      ]}
                    >
                      <TextInput
                        style={[styles.urlInput, { color: colors.text, backgroundColor: colors.inputBg }]}
                        placeholder="Enter a URL to import article…"
                        placeholderTextColor={colors.placeholder}
                        value={urlInput}
                        onChangeText={setUrlInput}
                        keyboardType="url"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="go"
                        onSubmitEditing={handleFetchUrl}
                        editable={!isFetching}
                      />
                      <Pressable
                        style={[
                          styles.fetchBtn,
                          { opacity: urlInput.trim().length === 0 || isFetching ? 0.4 : 1 },
                        ]}
                        onPress={handleFetchUrl}
                        disabled={urlInput.trim().length === 0 || isFetching}
                        accessibilityLabel="Import article from URL"
                      >
                        {isFetching ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Ionicons name="arrow-down-circle-outline" size={22} color="#FFFFFF" />
                        )}
                      </Pressable>
                    </View>
                    {fetchError && (
                      <Text style={[styles.urlError, { color: colors.accent }]}>{fetchError}</Text>
                    )}
                    {fetchedTitle ? (
                      <View style={styles.urlResultRow}>
                        <Text style={[styles.urlTitle, { color: colors.secondary }]} numberOfLines={1}>
                          Imported: {fetchedTitle}
                        </Text>
                        <TouchableOpacity 
                          onPress={() => setIsFeedbackVisible(true)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={styles.feedbackBtn}
                        >
                          <Text style={[styles.feedbackLink, { color: colors.accent }]}>Wrong content?</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  {/* Input card — grows to fill remaining space */}
                  <View
                    style={[
                      styles.inputCard,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                    ]}
                  >
                    <TextInput
                      multiline
                      placeholder="Paste any text here to begin…"
                      placeholderTextColor={colors.placeholder}
                      style={[styles.textInput, { color: colors.text, backgroundColor: colors.inputBg }]}
                      value={inputText}
                      onChangeText={(t) => { setInputText(t); setFetchedTitle(null); setCurrentUrl(''); }}
                      textAlignVertical="top"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    <View style={[styles.inputFooter, { borderTopColor: colors.inputBorder }]}>
                      {wordCount > 0 ? (
                        <Text style={[styles.metaText, { color: colors.secondary }]}>
                          {wordCount.toLocaleString()} words · ~{estimatedMin} min at 250 WPM
                        </Text>
                      ) : (
                        <Text style={[styles.metaText, { color: colors.placeholder }]}>
                          Paste any text to begin
                        </Text>
                      )}
                      <View style={styles.inputFooterActions}>
                        {inputText.length > 0 && (
                          <Pressable
                            onPress={() => { setInputText(''); setFetchedTitle(null); setCurrentUrl(''); }}
                            hitSlop={8}
                            accessibilityLabel="Clear text"
                          >
                            <Ionicons name="close-circle" size={18} color={colors.secondary} />
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => { setInputText(SAMPLE_TEXT); setCurrentUrl(''); }}
                          hitSlop={8}
                          accessibilityLabel="Load sample text"
                        >
                          <Text style={[styles.sampleLink, { color: colors.accent }]}>Sample text</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Start button */}
                  <Pressable
                    style={[styles.startBtn, { opacity: wordCount > 0 ? 1 : 0.35 }]}
                    onPress={handleStart}
                    disabled={wordCount === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Start reading"
                  >
                    <Text style={styles.startBtnText}>Start Reading</Text>
                  </Pressable>
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Feature bullets — outside KeyboardAvoidingView so they can fall behind keyboard */}
          <View style={styles.features}>
            {(
              [
                ['flash', 'RSVP technology', 'Words flash at a fixed focal point'],
                ['eye', 'ORP highlighting', 'Your eye locks on the recognition point'],
                ['document-text', 'Full text mode', 'See your progress across the whole text'],
              ] as const
            ).map(([iconName, title, desc]) => (
              <View
                key={title}
                style={[styles.featureRow, { borderBottomColor: colors.border }]}
              >
                <View style={styles.featureIconWrap}>
                  <Ionicons name={iconName} size={20} color={colors.accent} />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.secondary }]}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        <FeedbackModal
          isVisible={isFeedbackVisible}
          onClose={() => setIsFeedbackVisible(false)}
          url={currentUrl}
          extractedText={inputText}
          title={fetchedTitle ?? undefined}
          isDark={isDark}
        />
      </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ─── READER SCREEN ───────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Navigation header */}
      <View style={[styles.readerNav, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handleBack}
          style={styles.navBtn}
          hitSlop={12}
          accessibilityLabel="Back to home"
        >
          <Text style={[styles.navBtnText, { color: colors.accent }]}>← Back</Text>
        </Pressable>

        {/* Mode pill */}
        <View style={[styles.modePill, { backgroundColor: colors.surface }]}>
          <Pressable
            style={[
              styles.modeOption,
              readMode === 'rsvp' && [
                styles.modeOptionActive,
                { backgroundColor: colors.bg },
              ],
            ]}
            onPress={() => setReadMode('rsvp')}
            accessibilityLabel="Speed reading mode"
          >
            <Text
              style={[
                styles.modeOptionText,
                { color: readMode === 'rsvp' ? colors.text : colors.secondary },
              ]}
            >
              Speed
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeOption,
              readMode === 'full' && [
                styles.modeOptionActive,
                { backgroundColor: colors.bg },
              ],
            ]}
            onPress={() => setReadMode('full')}
            accessibilityLabel="Full text mode"
          >
            <Text
              style={[
                styles.modeOptionText,
                { color: readMode === 'full' ? colors.text : colors.secondary },
              ]}
            >
              Full Text
            </Text>
          </Pressable>
        </View>

        <View style={styles.navActions}>
          {currentUrl ? (
            <TouchableOpacity
              onPress={() => setIsFeedbackVisible(true)}
              style={styles.navBtn}
              hitSlop={12}
              accessibilityLabel="Report issue"
            >
              <Ionicons name="flag-outline" size={20} color={colors.secondary} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => setTheme(isDark ? 'light' : 'dark')}
            style={[styles.navBtn, styles.navBtnRight]}
            hitSlop={12}
            accessibilityLabel="Toggle theme"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={colors.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.flex}>
        {readMode === 'rsvp' ? (
          <RSVPReader />
        ) : (
          <TraditionalReader onWordPress={() => setReadMode('rsvp')} />
        )}
      </View>

      {/* Font size control — always visible at bottom */}
      <Controls />

      <FeedbackModal
        isVisible={isFeedbackVisible}
        onClose={() => setIsFeedbackVisible(false)}
        url={currentUrl}
        extractedText={inputText}
        title={fetchedTitle ?? undefined}
        isDark={isDark}
      />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // ── Home ──────────────────────────────────────────────────────────────────
  homeContainer: {
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  homeHeader: {
    marginBottom: 28,
    alignItems: 'flex-start',
  },
  homeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleMain: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  titleAccent: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 6,
    letterSpacing: 0.1,
  },
  inputCard: {
    height: 220,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 160,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sampleLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  startBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  features: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  featureIconWrap: {
    width: 32,
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  featureDesc: {
    fontSize: 13,
  },
  // ── URL import ────────────────────────────────────────────────────────────
  urlSection: {
    marginBottom: 16,
  },
  urlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingRight: 6,
  },
  urlInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  fetchBtn: {
    width: 44,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlError: {
    fontSize: 12,
    marginTop: 6,
    marginHorizontal: 4,
  },
  urlTitle: {
    fontSize: 12,
    flex: 1,
  },
  urlResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 4,
    gap: 8,
  },
  feedbackBtn: {
    paddingVertical: 2,
    paddingLeft: 4,
  },
  feedbackLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // ── Reader ─────────────────────────────────────────────────────────────────
  readerNav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    minWidth: 60,
    height: 44,
    justifyContent: 'center',
  },
  navBtnRight: {
    alignItems: 'flex-end',
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modePill: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  modeOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modeOptionActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
