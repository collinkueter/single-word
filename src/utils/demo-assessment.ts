import { buildDemoWords } from './demo-text';
import { parseText } from './text-parsing';

/**
 * Content and math for the two-stage "Speed Reading Test" demo.
 *
 * Stage 1 (baseline): the user reads a neutral passage at their own pace with a
 * manual start/stop timer, then answers 3 comprehension questions. We report raw
 * WPM and comprehension as two separate numbers.
 *
 * Stage 2 (RSVP): the user runs the existing accelerating demo (250 -> 700 WPM)
 * and answers 3 questions about it. We compare the two stages side by side.
 */

export interface QuizQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
}

// ── Stage 1: neutral baseline passage ──────────────────────────────────────────
export const BASELINE_PASSAGE =
  'Octopuses are among the most remarkable creatures in the ocean. An octopus has ' +
  'three hearts: two pump blood through the gills, while the third circulates it to ' +
  'the rest of the body. Their blood is blue because it relies on a copper-rich ' +
  'protein called hemocyanin, which carries oxygen more effectively than iron in ' +
  'cold, low-oxygen water. Octopuses are also strikingly intelligent. They can solve ' +
  'puzzles, open jars, and even use tools, carrying coconut shells to build shelters. ' +
  'Their nervous system is unusual too: about two-thirds of their neurons sit in ' +
  'their arms rather than their brain, so each arm can taste, touch, and react on ' +
  'its own. Perhaps their most famous skill is camouflage. Using cells called ' +
  'chromatophores, an octopus can change the color and texture of its skin in under ' +
  'a second, blending into rocks, coral, or sand to vanish from predators.';

export const BASELINE_WORD_COUNT = parseText(BASELINE_PASSAGE).length;

export const BASELINE_QUESTIONS: QuizQuestion[] = [
  {
    prompt: 'How many hearts does an octopus have?',
    options: ['One', 'Two', 'Three', 'Four'],
    correctIndex: 2,
  },
  {
    prompt: "Why is an octopus's blood blue?",
    options: [
      'It is rich in iron',
      'It relies on a copper-based protein called hemocyanin',
      'It reflects the color of the ocean',
      'It carries very little oxygen',
    ],
    correctIndex: 1,
  },
  {
    prompt: "Where are most of an octopus's neurons located?",
    options: [
      'In its brain',
      'Spread evenly through its body',
      'In its three hearts',
      'In its arms',
    ],
    correctIndex: 3,
  },
];

// ── Stage 2: questions about the RSVP teaching demo ────────────────────────────
export const DEMO_QUESTIONS: QuizQuestion[] = [
  {
    prompt: 'What does RSVP stand for?',
    options: [
      'Rapid Serial Visual Presentation',
      'Reading Speed Visual Practice',
      'Rapid Sentence Verbal Processing',
      'Random Sequential Visual Pattern',
    ],
    correctIndex: 0,
  },
  {
    prompt: 'What is the red highlighted letter in each word called?',
    options: [
      'The focal marker',
      'The anchor letter',
      'The Optimal Recognition Point',
      'The saccade point',
    ],
    correctIndex: 2,
  },
  {
    prompt: 'What is subvocalization?',
    options: [
      'The jump your eyes make across a page',
      'The inner voice that reads along with you',
      'A word shown at a single focal point',
      'Reading without understanding',
    ],
    correctIndex: 1,
  },
];

// ── Stage 2 speed, derived deterministically from the demo definition ──────────
// RSVPReader shows each word for (60000 / targetWpm) * delayMultiplier ms, so the
// average presentation speed is total words / total presentation time.
function computeDemoSpeed(): { averageWpm: number; peakWpm: number; wordCount: number } {
  const { words } = buildDemoWords();
  let totalMs = 0;
  let peakWpm = 0;
  for (const word of words) {
    const wpm = word.targetWpm ?? 250;
    totalMs += (60000 / wpm) * (word.delayMultiplier ?? 1);
    if (wpm > peakWpm) peakWpm = wpm;
  }
  const averageWpm = totalMs > 0 ? Math.round(words.length / (totalMs / 60000)) : 0;
  return { averageWpm, peakWpm, wordCount: words.length };
}

export const DEMO_SPEED = computeDemoSpeed();

// ── Helpers ────────────────────────────────────────────────────────────────────
/** Raw reading speed in whole words per minute. */
export function wpmFromElapsed(wordCount: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return Math.round(wordCount / (elapsedMs / 60000));
}

/** Count of correct answers for a quiz. */
export function scoreQuiz(answers: (number | null)[], questions: QuizQuestion[]): number {
  return questions.reduce(
    (total, question, i) => total + (answers[i] === question.correctIndex ? 1 : 0),
    0
  );
}

/** Format milliseconds as m:ss (or ss s under a minute). */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
