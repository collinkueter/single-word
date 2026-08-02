import { WordObject, parseText } from './text-parsing';

/**
 * Demo text segments with target WPM for each section.
 * The story starts slow and gradually ramps up speed to demonstrate
 * how RSVP reading trains you to read faster.
 */
const DEMO_SEGMENTS: { text: string; wpm: number }[] = [
  {
    text: 'Welcome to Single Word. This is a quick demo to show you how speed reading works. Right now you are reading at a comfortable pace of 250 words per minute. This is about average for most adults.',
    wpm: 250,
  },
  {
    text: 'Traditional reading forces your eyes to jump across the page in movements called saccades. Each jump takes time and mental energy. Your brain spends more effort finding the next word than actually understanding it.',
    wpm: 275,
  },
  {
    text: 'RSVP stands for Rapid Serial Visual Presentation. Instead of moving your eyes across text each word appears at a single focal point. Your brain can focus entirely on comprehension rather than navigation.',
    wpm: 300,
  },
  {
    text: 'Notice the red highlighted letter in each word. That is the Optimal Recognition Point. Your eye naturally locks onto this position allowing your brain to recognize the word instantly without scanning it.',
    wpm: 350,
  },
  {
    text: 'You may have noticed the speed is increasing. You are now reading faster than most people read normally. The key insight is that your brain can process words much faster than your eyes can move across a page.',
    wpm: 400,
  },
  {
    text: 'By eliminating eye movement and reducing subvocalization which is that inner voice reading along with you it becomes possible to absorb text at speeds that would feel impossible with a traditional book or article.',
    wpm: 450,
  },
  {
    text: 'Right now you are reading at nearly double the average reading speed. With practice this becomes natural. Many speed readers consistently achieve 500 to 800 words per minute while maintaining strong comprehension.',
    wpm: 500,
  },
  {
    text: 'The speed is still climbing and yet you can still understand every word. Your brain is adapting in real time. This is the power of focused attention combined with optimized word presentation.',
    wpm: 575,
  },
  {
    text: 'You are now reading at 650 words per minute which is more than double the average. Imagine reading an entire book in half the time. Imagine getting through your daily articles and emails twice as fast.',
    wpm: 650,
  },
  {
    text: 'This is 700 words per minute. You made it. Paste any text or import a URL to start speed reading for real. The more you practice the faster and more natural it becomes. Happy reading.',
    wpm: 700,
  },
];

/**
 * Build WordObject[] for the demo with per-word targetWpm values.
 */
export function buildDemoWords(): { text: string; words: WordObject[] } {
  const allWords: WordObject[] = [];
  const fullText = DEMO_SEGMENTS.map((s) => s.text).join(' ');

  for (const segment of DEMO_SEGMENTS) {
    const segmentWords = parseText(segment.text);
    for (const word of segmentWords) {
      allWords.push({ ...word, targetWpm: segment.wpm });
    }
  }

  return { text: fullText, words: allWords };
}
