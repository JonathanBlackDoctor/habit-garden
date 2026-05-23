import { create } from 'zustand';

export type GardenTheme = 'meadow' | 'sunset';

const STORAGE_KEY = 'garden.theme';

function loadInitial(): GardenTheme {
  if (typeof window === 'undefined') return 'meadow';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'sunset' ? 'sunset' : 'meadow';
}

interface GardenThemeStore {
  theme: GardenTheme;
  setTheme: (t: GardenTheme) => void;
  toggle: () => void;
}

export const useGardenTheme = create<GardenThemeStore>((set, get) => ({
  theme: loadInitial(),
  setTheme: (t) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, t);
    set({ theme: t });
  },
  toggle: () => {
    const next: GardenTheme = get().theme === 'meadow' ? 'sunset' : 'meadow';
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
    set({ theme: next });
  },
}));
