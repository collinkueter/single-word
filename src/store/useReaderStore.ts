import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WordObject, parseText } from '../utils/text-parsing';

interface ReaderState {
  rawText: string;
  words: WordObject[];
  currentIndex: number;
  wpm: number;
  theme: 'light' | 'dark';
  fontSize: number;

  setText: (text: string) => void;
  setCurrentIndex: (index: number) => void;
  setWPM: (wpm: number) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontSize: (size: number) => void;
  resetProgress: () => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      rawText: '',
      words: [],
      currentIndex: 0,
      wpm: 250,
      theme: 'light',
      fontSize: 40,

      setText: (text) => {
        const words = parseText(text);
        set({ rawText: text, words, currentIndex: 0 });
      },
      setCurrentIndex: (index) => set({ currentIndex: index }),
      setWPM: (wpm) => set({ wpm }),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      resetProgress: () => set({ currentIndex: 0 }),
    }),
    {
      name: 'singleword-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
