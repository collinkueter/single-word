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
  readAloudEnabled: boolean;
  selectedVoice: string | null;
  isDemo: boolean;

  setText: (text: string) => void;
  setDemoText: (text: string, words: WordObject[]) => void;
  setCurrentIndex: (index: number) => void;
  setWPM: (wpm: number) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontSize: (size: number) => void;
  setReadAloudEnabled: (enabled: boolean) => void;
  setSelectedVoice: (voice: string | null) => void;
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
      readAloudEnabled: false,
      selectedVoice: null,
      isDemo: false,

      setText: (text) => {
        const words = parseText(text);
        set({ rawText: text, words, currentIndex: 0, isDemo: false });
      },
      setDemoText: (text, words) => {
        set({ rawText: text, words, currentIndex: 0, isDemo: true });
      },
      setCurrentIndex: (index) => set({ currentIndex: index }),
      setWPM: (wpm) => set({ wpm }),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setReadAloudEnabled: (readAloudEnabled) => set({ readAloudEnabled }),
      setSelectedVoice: (selectedVoice) => set({ selectedVoice }),
      resetProgress: () => set({ currentIndex: 0 }),
    }),
    {
      name: 'singleword-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
