import { create } from 'zustand';
import { User } from 'firebase/auth';
import { plannerDate } from './dayBoundary';

interface AppState {
  currentDate: string;
  setCurrentDate: (date: string) => void;
  uid: string | null;
  setUid: (uid: string | null) => void;
  user: User | null;
  authLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentDate:     plannerDate(),
  setCurrentDate:  (date) => set({ currentDate: date }),
  uid:             null,
  setUid:          (uid) => set({ uid }),
  user:            null,
  authLoading:     true,
  setUser:         (user) => set({ user }),
  setAuthLoading:  (loading) => set({ authLoading: loading }),
}));
