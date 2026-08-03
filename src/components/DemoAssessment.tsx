import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RSVPReader } from './RSVPReader';
import { useReaderStore } from '../store/useReaderStore';
import { buildDemoWords } from '../utils/demo-text';
import {
  BASELINE_PASSAGE,
  BASELINE_WORD_COUNT,
  BASELINE_QUESTIONS,
  DEMO_QUESTIONS,
  DEMO_SPEED,
  QuizQuestion,
  wpmFromElapsed,
  scoreQuiz,
  formatElapsed,
} from '../utils/demo-assessment';

interface DemoAssessmentProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onExit: () => void;
}

type Step =
  | 'intro'
  | 'baselineRead'
  | 'baselineQuiz'
  | 'baselineResult'
  | 'demoRead'
  | 'demoQuiz'
  | 'final';

function buildColors(isDark: boolean) {
  return {
    bg: isDark ? '#000000' : '#FFFFFF',
    surface: isDark ? '#1C1C1E' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6D6D72',
    accent: '#FF3B30',
    green: '#34C759',
    greenTint: isDark ? '#0E2A16' : '#E8F5E9',
    redTint: isDark ? '#3A1A1A' : '#FFEBEE',
    border: isDark ? '#38383A' : '#E5E5EA',
  };
}

type Colors = ReturnType<typeof buildColors>;

// ── Reusable multiple-choice quiz ──────────────────────────────────────────────
interface QuizViewProps {
  questions: QuizQuestion[];
  colors: Colors;
  onComplete: (correct: number) => void;
}

function QuizView({ questions, colors, onComplete }: QuizViewProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null)
  );

  const question = questions[index];
  const selected = answers[index];
  const answered = selected !== null;
  const isLast = index === questions.length - 1;

  const handleSelect = (choice: number) => {
    if (answered) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = choice;
      return next;
    });
    Haptics.notificationAsync(
      choice === question.correctIndex
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );
  };

  const handleNext = () => {
    if (!answered) return;
    if (isLast) {
      onComplete(scoreQuiz(answers, questions));
    } else {
      setIndex(index + 1);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.quizScroll}>
        <Text style={[styles.quizProgress, { color: colors.secondary }]}>
          Question {index + 1} of {questions.length}
        </Text>
        <Text style={[styles.quizPrompt, { color: colors.text }]}>{question.prompt}</Text>

        <View style={styles.optionList}>
          {question.options.map((option, i) => {
            const isCorrect = i === question.correctIndex;
            const isChosen = selected === i;
            let backgroundColor = colors.surface;
            let borderColor = 'transparent';
            let iconName: React.ComponentProps<typeof Ionicons>['name'] | null = null;
            let iconColor = colors.secondary;

            if (answered && isCorrect) {
              backgroundColor = colors.greenTint;
              borderColor = colors.green;
              iconName = 'checkmark-circle';
              iconColor = colors.green;
            } else if (answered && isChosen) {
              backgroundColor = colors.redTint;
              borderColor = colors.accent;
              iconName = 'close-circle';
              iconColor = colors.accent;
            }

            return (
              <Pressable
                key={option}
                style={[styles.option, { backgroundColor, borderColor }]}
                onPress={() => handleSelect(i)}
                disabled={answered}
                accessibilityRole="button"
                accessibilityLabel={option}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {iconName ? (
                  <Ionicons name={iconName} size={22} color={iconColor} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <PrimaryButton
        label={isLast ? 'See results' : 'Next'}
        colors={colors}
        disabled={!answered}
        onPress={handleNext}
      />
    </View>
  );
}

// ── Small building blocks ──────────────────────────────────────────────────────
function PrimaryButton({
  label,
  colors,
  onPress,
  disabled,
}: {
  label: string;
  colors: Colors;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryBtn, { opacity: disabled ? 0.35 : 1 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function StatBlock({
  label,
  wpm,
  correct,
  colors,
  accentColor,
  footnote,
}: {
  label: string;
  wpm: number;
  correct: number;
  colors: Colors;
  accentColor: string;
  footnote?: string;
}) {
  return (
    <View style={[styles.statBlock, { backgroundColor: colors.surface }]}>
      <Text style={[styles.statLabel, { color: colors.secondary }]}>{label}</Text>
      <Text style={[styles.statWpm, { color: accentColor }]}>{wpm}</Text>
      <Text style={[styles.statUnit, { color: colors.secondary }]}>words per minute</Text>
      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
      <Text style={[styles.statComp, { color: colors.text }]}>
        {correct}/3 correct
      </Text>
      <Text style={[styles.statUnit, { color: colors.secondary }]}>comprehension</Text>
      {footnote ? (
        <Text style={[styles.statFootnote, { color: colors.secondary }]}>{footnote}</Text>
      ) : null}
    </View>
  );
}

// ── Main flow ───────────────────────────────────────────────────────────────────
export function DemoAssessment({ isDark, onToggleTheme, onExit }: DemoAssessmentProps) {
  const colors = buildColors(isDark);
  const { setDemoText, setText } = useReaderStore();
  const demo = useMemo(() => buildDemoWords(), []);

  const [step, setStep] = useState<Step>('intro');
  const [reading, setReading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [baselineElapsedMs, setBaselineElapsedMs] = useState(0);
  const [baselineCorrect, setBaselineCorrect] = useState(0);
  const [demoCorrect, setDemoCorrect] = useState(0);
  const startRef = useRef<number | null>(null);

  // Clear any demo text from the shared store when the assessment goes away, so
  // the app falls back to the home screen rather than a stray reader session.
  useEffect(() => {
    return () => setText('');
  }, [setText]);

  // Live-updating stopwatch while the user reads the baseline passage.
  useEffect(() => {
    if (!reading) return;
    const id = setInterval(() => {
      if (startRef.current !== null) setElapsedMs(Date.now() - startRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [reading]);

  const handleExit = useCallback(() => {
    setText('');
    onExit();
  }, [setText, onExit]);

  const startBaselineTimer = () => {
    startRef.current = Date.now();
    setElapsedMs(0);
    setReading(true);
  };

  const finishBaselineTimer = () => {
    const total = startRef.current !== null ? Date.now() - startRef.current : elapsedMs;
    startRef.current = null;
    setReading(false);
    setBaselineElapsedMs(total);
    setStep('baselineQuiz');
  };

  const startDemo = () => {
    setDemoText(demo.text, demo.words);
    setStep('demoRead');
  };

  const restart = () => {
    setText('');
    setReading(false);
    startRef.current = null;
    setElapsedMs(0);
    setBaselineElapsedMs(0);
    setBaselineCorrect(0);
    setDemoCorrect(0);
    setStep('intro');
  };

  const baselineWpm = wpmFromElapsed(BASELINE_WORD_COUNT, baselineElapsedMs);
  const speedMultiplier =
    baselineWpm > 0 ? DEMO_SPEED.averageWpm / baselineWpm : 0;

  const header = (title: string, showClose = true) => (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {showClose ? (
        <Pressable
          onPress={handleExit}
          style={styles.headerBtn}
          hitSlop={12}
          accessibilityLabel="Close speed reading test"
        >
          <Ionicons name="close" size={24} color={colors.secondary} />
        </Pressable>
      ) : (
        <View style={styles.headerBtn} />
      )}
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <Pressable
        onPress={onToggleTheme}
        style={[styles.headerBtn, styles.headerBtnRight]}
        hitSlop={12}
        accessibilityLabel="Toggle theme"
      >
        <Ionicons
          name={isDark ? 'sunny-outline' : 'moon-outline'}
          size={20}
          color={colors.secondary}
        />
      </Pressable>
    </View>
  );

  let body: React.ReactNode;

  if (step === 'intro') {
    body = (
      <>
        {header('Speed Reading Test')}
        <ScrollView contentContainerStyle={styles.centeredScroll}>
          <View style={[styles.iconBadge, { backgroundColor: colors.surface }]}>
            <Ionicons name="speedometer-outline" size={40} color={colors.accent} />
          </View>
          <Text style={[styles.bigTitle, { color: colors.text }]}>
            How fast do you read?
          </Text>
          <Text style={[styles.paragraph, { color: colors.secondary }]}>
            First, read a short passage at your normal pace and answer a few questions.
            Then try speed reading the same way and compare. Takes about two minutes.
          </Text>
          <View style={styles.stepsList}>
            <StepRow n={1} text="Read a passage — we time you" colors={colors} />
            <StepRow n={2} text="Answer 3 quick questions" colors={colors} />
            <StepRow n={3} text="Speed read, then compare your results" colors={colors} />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Start" colors={colors} onPress={() => setStep('baselineRead')} />
        </View>
      </>
    );
  } else if (step === 'baselineRead') {
    body = (
      <>
        {header('Part 1 of 2')}
        {reading ? (
          <>
            <View style={styles.timerRow}>
              <Ionicons name="timer-outline" size={20} color={colors.accent} />
              <Text style={[styles.timerText, { color: colors.text }]}>
                {formatElapsed(elapsedMs)}
              </Text>
            </View>
            <ScrollView contentContainerStyle={styles.passageScroll}>
              <Text style={[styles.passage, { color: colors.text }]}>{BASELINE_PASSAGE}</Text>
            </ScrollView>
            <View style={styles.footer}>
              <PrimaryButton label="I'm done reading" colors={colors} onPress={finishBaselineTimer} />
            </View>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.centeredScroll}>
              <View style={[styles.iconBadge, { backgroundColor: colors.surface }]}>
                <Ionicons name="book-outline" size={40} color={colors.accent} />
              </View>
              <Text style={[styles.bigTitle, { color: colors.text }]}>Read at your normal pace</Text>
              <Text style={[styles.paragraph, { color: colors.secondary }]}>
                When you tap Start, a short passage appears and the timer begins. Read it as you
                normally would, then tap “I’m done” the moment you finish.
              </Text>
            </ScrollView>
            <View style={styles.footer}>
              <PrimaryButton label="Start reading" colors={colors} onPress={startBaselineTimer} />
            </View>
          </>
        )}
      </>
    );
  } else if (step === 'baselineQuiz') {
    body = (
      <>
        {header('Part 1 of 2')}
        <QuizView
          questions={BASELINE_QUESTIONS}
          colors={colors}
          onComplete={(correct) => {
            setBaselineCorrect(correct);
            setStep('baselineResult');
          }}
        />
      </>
    );
  } else if (step === 'baselineResult') {
    body = (
      <>
        {header('Part 1 complete', false)}
        <ScrollView contentContainerStyle={styles.centeredScroll}>
          <Text style={[styles.paragraph, styles.center, { color: colors.secondary }]}>
            You read {BASELINE_WORD_COUNT} words in {formatElapsed(baselineElapsedMs)}
          </Text>
          <Text style={[styles.hugeWpm, { color: colors.accent }]}>{baselineWpm}</Text>
          <Text style={[styles.hugeUnit, { color: colors.secondary }]}>words per minute</Text>
          <Text style={[styles.compLine, { color: colors.text }]}>
            {baselineCorrect}/3 comprehension
          </Text>
          <Text style={[styles.paragraph, styles.center, { color: colors.secondary }]}>
            That’s a typical baseline. Now let’s see what speed reading can do.
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Try speed reading" colors={colors} onPress={startDemo} />
        </View>
      </>
    );
  } else if (step === 'demoRead') {
    body = (
      <>
        {header('Part 2 of 2')}
        <Text style={[styles.hint, { color: colors.secondary }]}>
          Press play and read along — the words speed up as you go.
        </Text>
        <View style={styles.flex}>
          <RSVPReader onFinished={() => setStep('demoQuiz')} />
        </View>
      </>
    );
  } else if (step === 'demoQuiz') {
    body = (
      <>
        {header('Part 2 of 2')}
        <QuizView
          questions={DEMO_QUESTIONS}
          colors={colors}
          onComplete={(correct) => {
            setDemoCorrect(correct);
            setText('');
            setStep('final');
          }}
        />
      </>
    );
  } else {
    // final
    body = (
      <>
        {header('Your results', false)}
        <ScrollView contentContainerStyle={styles.resultsScroll}>
          {speedMultiplier >= 1.1 ? (
            <Text style={[styles.multiplier, { color: colors.accent }]}>
              {speedMultiplier.toFixed(1)}× faster
            </Text>
          ) : (
            <Text style={[styles.multiplier, { color: colors.accent }]}>
              {DEMO_SPEED.averageWpm} WPM
            </Text>
          )}
          <Text style={[styles.paragraph, styles.center, { color: colors.secondary }]}>
            Here’s how speed reading compared to your normal pace.
          </Text>
          <View style={styles.statRow}>
            <StatBlock
              label="Normal"
              wpm={baselineWpm}
              correct={baselineCorrect}
              colors={colors}
              accentColor={colors.text}
            />
            <StatBlock
              label="Speed reading"
              wpm={DEMO_SPEED.averageWpm}
              correct={demoCorrect}
              colors={colors}
              accentColor={colors.accent}
              footnote={`peaked at ${DEMO_SPEED.peakWpm} WPM`}
            />
          </View>
          <Text style={[styles.paragraph, styles.center, { color: colors.secondary }]}>
            With practice this becomes natural. Paste any text or import an article to keep going.
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Read your own text" colors={colors} onPress={handleExit} />
          <Pressable
            onPress={restart}
            style={styles.secondaryBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Take the test again"
          >
            <Text style={[styles.secondaryBtnText, { color: colors.accent }]}>Take it again</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {body}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function StepRow({ n, text, colors }: { n: number; text: string; colors: Colors }) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepNum, { backgroundColor: colors.accent }]}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerBtnRight: { alignItems: 'flex-end' },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  centeredScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bigTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  center: { textAlign: 'center' },

  stepsList: {
    marginTop: 16,
    gap: 16,
    alignSelf: 'stretch',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 16,
    flex: 1,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Baseline reading
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  timerText: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  passageScroll: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  passage: {
    fontSize: 19,
    lineHeight: 30,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
  },

  // Quiz
  quizScroll: {
    padding: 24,
    gap: 8,
  },
  quizProgress: {
    fontSize: 13,
    fontWeight: '600',
  },
  quizPrompt: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 8,
  },
  optionList: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },

  // Baseline result
  hugeWpm: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2,
  },
  hugeUnit: {
    fontSize: 16,
    marginTop: -4,
  },
  compLine: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },

  // Final results
  resultsScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  multiplier: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBlock: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statWpm: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 6,
  },
  statUnit: {
    fontSize: 12,
  },
  statDivider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 12,
  },
  statComp: {
    fontSize: 20,
    fontWeight: '700',
  },
  statFootnote: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
