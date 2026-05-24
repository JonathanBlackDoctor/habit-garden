import { create } from 'zustand';
import { User } from 'firebase/auth';
import { plannerDate } from './dayBoundary';
import type { UserProfileDoc, UserSettingsDoc } from 'shared/types/firestore';

// 콤보 윈도우: 마지막 체크로부터 이 시간 안에 다음 체크 시 콤보 유지
export const COMBO_WINDOW_MS = 30_000;

interface AppState {
  currentDate: string;
  setCurrentDate: (date: string) => void;
  uid: string | null;
  setUid: (uid: string | null) => void;
  user: User | null;
  authLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;

  profile: UserProfileDoc | null;
  setProfile: (profile: UserProfileDoc | null) => void;
  settings: UserSettingsDoc | null;
  setSettings: (settings: UserSettingsDoc | null) => void;

  // ── 콤보 (Phase 1-3) ──
  currentCombo: number;
  lastCheckAt: number;            // epoch ms, 0 = 없음
  /** 다음 체크가 콤보로 이어지는지 계산하고 카운터를 갱신. 신규 콤보 수치 반환. */
  bumpCombo: () => number;
  resetCombo: () => void;

  // ── 하루 1회 보상 게이트 ──
  // 오늘 이미 보상 피드백(포인트 토스트·콤보·셀러브레이션)을 준 습관 id.
  // 서버가 포인트 중복 지급을 막지만, 클라이언트 연출도 하루 한 번만 나오게 한다.
  rewardedHabitIds: Record<string, true>;
  /** 아직 오늘 보상하지 않은 습관이면 표시 후 true 반환, 이미 보상했으면 false. */
  tryRewardHabit: (habitId: string) => boolean;

  // ── 셀러브레이션 트리거 (Phase 1-1) ──
  celebrationKind: 'perfect' | 'streak7' | 'levelup' | null;
  celebrationPayload?: { title: string; points: number; detail?: string };
  triggerCelebration: (
    kind: 'perfect' | 'streak7' | 'levelup',
    payload: { title: string; points: number; detail?: string },
  ) => void;
  clearCelebration: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentDate:     plannerDate(),
  setCurrentDate:  (date) => set({ currentDate: date, rewardedHabitIds: {} }),
  uid:             null,
  setUid:          (uid) => set({ uid }),
  user:            null,
  authLoading:     true,
  setUser:         (user) => set({ user }),
  setAuthLoading:  (loading) => set({ authLoading: loading }),

  profile:         null,
  setProfile:      (profile) => set({ profile }),
  settings:        null,
  setSettings:     (settings) => set({ settings }),

  currentCombo:    0,
  lastCheckAt:     0,
  bumpCombo: () => {
    const now = Date.now();
    const { currentCombo, lastCheckAt } = get();
    const next = (lastCheckAt && now - lastCheckAt <= COMBO_WINDOW_MS)
      ? currentCombo + 1
      : 1;
    set({ currentCombo: next, lastCheckAt: now });
    return next;
  },
  resetCombo: () => set({ currentCombo: 0, lastCheckAt: 0 }),

  rewardedHabitIds: {},
  tryRewardHabit: (habitId) => {
    if (get().rewardedHabitIds[habitId]) return false;
    set((s) => ({ rewardedHabitIds: { ...s.rewardedHabitIds, [habitId]: true } }));
    return true;
  },

  celebrationKind:    null,
  celebrationPayload: undefined,
  triggerCelebration: (kind, payload) =>
    set({ celebrationKind: kind, celebrationPayload: payload }),
  clearCelebration:   () => set({ celebrationKind: null, celebrationPayload: undefined }),
}));
