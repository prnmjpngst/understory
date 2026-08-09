import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  themeMode: ThemeMode;
  // URI/quant overrides come later (D9); paths default to app document dir.
  chatModelPath: string | null;
  embeddingModelPath: string | null;
  setThemeMode: (mode: ThemeMode) => void;
  setChatModelPath: (path: string | null) => void;
  setEmbeddingModelPath: (path: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      chatModelPath: null,
      embeddingModelPath: null,
      setThemeMode: (themeMode) => set({ themeMode }),
      setChatModelPath: (chatModelPath) => set({ chatModelPath }),
      setEmbeddingModelPath: (embeddingModelPath) =>
        set({ embeddingModelPath }),
    }),
    {
      name: 'understory-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
