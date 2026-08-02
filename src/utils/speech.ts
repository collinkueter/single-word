import * as Speech from 'expo-speech';
import { WordObject } from './text-parsing';

const MAX_READ_ALOUD_WPM = 350;

/**
 * Convert WPM to expo-speech rate.
 * expo-speech normalizes rate so 1.0 = normal speaking speed on both platforms.
 * Normal speaking speed is ~150 WPM for English, so rate = wpm / 150.
 * Values above 1.0 speed up, below 1.0 slow down.
 */
const NORMAL_SPEECH_WPM = 150;

export function wpmToSpeechRate(wpm: number): number {
  const clamped = Math.min(wpm, MAX_READ_ALOUD_WPM);
  return Math.max(0.1, clamped / NORMAL_SPEECH_WPM);
}

export function isWpmTooFastForSpeech(wpm: number): boolean {
  return wpm > MAX_READ_ALOUD_WPM;
}

export interface SentenceSegment {
  text: string;
  startIndex: number;
  endIndex: number;
  /** Character offsets for each word within the sentence text */
  wordCharOffsets: number[];
}

export function segmentIntoSentences(words: WordObject[]): SentenceSegment[] {
  if (words.length === 0) return [];

  const sentences: SentenceSegment[] = [];
  let sentenceStart = 0;

  for (let i = 0; i < words.length; i++) {
    const isEnd = words[i].delayMultiplier === 2.0 || i === words.length - 1;
    if (isEnd) {
      const sentenceWords = words.slice(sentenceStart, i + 1).map((w) => w.text);
      // Build character offset map for each word in the joined sentence
      const wordCharOffsets: number[] = [];
      let offset = 0;
      for (const w of sentenceWords) {
        wordCharOffsets.push(offset);
        offset += w.length + 1; // +1 for the space
      }
      sentences.push({
        text: sentenceWords.join(' '),
        startIndex: sentenceStart,
        endIndex: i,
        wordCharOffsets,
      });
      sentenceStart = i + 1;
    }
  }

  return sentences;
}

export function findSentenceForIndex(
  sentences: SentenceSegment[],
  wordIndex: number
): number {
  for (let i = 0; i < sentences.length; i++) {
    if (wordIndex >= sentences[i].startIndex && wordIndex <= sentences[i].endIndex) {
      return i;
    }
  }
  return 0;
}

/**
 * Map a charIndex from an onBoundary event to the global word index
 * within the given sentence segment.
 */
export function charIndexToWordIndex(
  sentence: SentenceSegment,
  charIndex: number
): number {
  // Find the word whose char offset is <= charIndex
  let wordOffset = 0;
  for (let i = sentence.wordCharOffsets.length - 1; i >= 0; i--) {
    if (charIndex >= sentence.wordCharOffsets[i]) {
      wordOffset = i;
      break;
    }
  }
  return sentence.startIndex + wordOffset;
}

export interface SpeakOptions {
  text: string;
  wpm: number;
  voice?: string;
  onBoundary?: (charIndex: number, charLength: number) => void;
}

/**
 * Speak a sentence with optional onBoundary callback for word-level sync.
 */
export function speakSentence(options: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(options.text, {
      rate: wpmToSpeechRate(options.wpm),
      voice: options.voice,
      onBoundary: options.onBoundary
        ? (event: { charIndex: number; charLength: number }) => {
            options.onBoundary!(event.charIndex, event.charLength);
          }
        : undefined,
      onDone: resolve,
      onStopped: resolve,
      onError: () => resolve(),
    });
  });
}

export function stopSpeech(): void {
  Speech.stop();
}

export async function getAvailableVoices(): Promise<Speech.Voice[]> {
  return Speech.getAvailableVoicesAsync();
}

export { MAX_READ_ALOUD_WPM };
