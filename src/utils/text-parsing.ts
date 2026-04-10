export interface WordObject {
  text: string;
  orpIndex: number;
  delayMultiplier: number;
}

/**
 * Calculates the Optimal Recognition Point (ORP) index for a given word.
 * Standard speed reading algorithm:
 * - 1 letter: index 0
 * - 2-4 letters: index 1
 * - 5-9 letters: index 2
 * - 10-13 letters: index 3
 * - 14+ letters: index 4
 */
export const getORPIndex = (word: string): number => {
  const length = word.length;
  if (length === 0) return 0;
  if (length === 1) return 0;
  if (length <= 4) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
};

/**
 * Parses raw text into an array of WordObjects with metadata for speed reading.
 */
export const parseText = (text: string): WordObject[] => {
  if (!text) return [];

  const rawWords = text.trim().split(/\s+/);

  return rawWords
    .filter((word) => word.length > 0)
    .map((word) => {
      let delayMultiplier = 1.0;

      if (/[.!?]$/.test(word)) {
        delayMultiplier = 2.0;
      } else if (/[,;:]$/.test(word)) {
        delayMultiplier = 1.5;
      } else if (word.length > 8) {
        delayMultiplier = 1.2;
      }

      return {
        text: word,
        orpIndex: getORPIndex(word),
        delayMultiplier,
      };
    });
};
