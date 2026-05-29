import { useEffect } from 'react';
import { create } from 'zustand';
import { User } from 'firebase/auth';
import { plannerDate } from './dayBoundary';
import type { UserProfileDoc, UserSettingsDoc } from 'shared/types/firestore';

// ── 샌드박스(개발자 테스트) 모드 ──
// 켜면 모든 데이터 경로가 실제 uid 대신 `${uid}__sandbox` 네임스페이스로 바뀐다.
// 실제 데이터는 전혀 건드리지 않으며, 끄면 즉시 실제 데이터로 복귀한다.
const SANDBOX_KEY = 'hg_sandbox';
export const SANDBOX_SUFFIX = '__sandbox';
function readSandbox(): boolean {
  try { return localStorage.getItem(SANDBOX_KEY) === '1'; } catch { return false; }
}
function effectiveUid(realUid: string | null, sandbox: boolean): string | null {
  if (!realUid) return null;
  return sandbox ? `${realUid}${SANDBOX_SUFFIX}` : realUid;
}

interface AppState {
  currentDate: string;
  setCurrentDate: (date: string) => void;
  // uid = 데이터 경로용 유효 uid (샌드박스 모드면 `${realUid}__sandbox`).
  // realUid = 실제 인증 uid (owner 판별·인증 로직용). sandbox 토글과 무관하게 불변.
  uid: string | null;
  realUid: string | null;
  sandbox: boolean;
  setRealUid: (uid: string | null) => void;
  setSandbox: (on: boolean) => void;
  user: User | null;
  authLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;

  profile: UserProfileDoc | null;
  setProfile: (profile: UserProfileDoc | null) => void;
  settings: UserSettingsDoc | null;
  setSettings: (settings: UserSettingsDoc | null) => void;

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

  // ── 레벨업 창 (보상 수령) ──
  // 서버가 보상을 자동 지급하면 progress 변화를 감지해 fromLevel→toLevel 구간을 띄운다.
  // 사용자가 "보상 수령"을 누르면 닫힌다(보상 자체는 이미 계정에 반영됨).
  levelUp: { fromLevel: number; toLevel: number } | null;
  /** 레벨업 창을 띄운다. 이미 열려 있으면 구간을 합쳐 가장 넓게 표시. */
  showLevelUp: (fromLevel: number, toLevel: number) => void;
  clearLevelUp: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentDate:     plannerDate(),
  setCurrentDate:  (date) => set({ currentDate: date, rewardedHabitIds: {} }),
  realUid:         null,
  sandbox:         readSandbox(),
  uid:             null,
  setRealUid:      (realUid) =>
    set((s) => ({ realUid, uid: effectiveUid(realUid, s.sandbox) })),
  setSandbox: (on) => {
    try { localStorage.setItem(SANDBOX_KEY, on ? '1' : '0'); } catch { /* noop */ }
    set((s) => ({
      sandbox: on,
      uid: effectiveUid(s.realUid, on),
      // 모드 전환 시 하루 보상 게이트 초기화 (모드 간 연출 혼선 방지)
      rewardedHabitIds: {},
    }));
  },
  user:            null,
  authLoading:     true,
  setUser:         (user) => set({ user }),
  setAuthLoading:  (loading) => set({ authLoading: loading }),

  profile:         null,
  setProfile:      (profile) => set({ profile }),
  settings:        null,
  setSettings:     (settings) => set({ settings }),

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

  levelUp: null,
  showLevelUp: (fromLevel, toLevel) =>
    set((s) => ({
      levelUp: {
        fromLevel: s.levelUp ? Math.min(s.levelUp.fromLevel, fromLevel) : fromLevel,
        toLevel:   s.levelUp ? Math.max(s.levelUp.toLevel, toLevel)     : toLevel,
      },
    })),
  clearLevelUp: () => set({ levelUp: null }),
}));

/**
 * 04:00 KST 일일 경계 자동 롤오버.
 * 앱(PWA)을 켜둔 채 자정~04:00 을 넘겨도 currentDate 가 그날의 '오늘'로 갱신되지 않으면
 * 습관 체크·회고·할 일이 어제 문서(days/{yesterday})에 기록된다. 이를 막기 위해
 * 가시성 복귀·포커스·주기적(30초) 으로 plannerDate() 를 재계산해 바뀌면 갱신한다.
 */
export function useDayRollover() {
  useEffect(() => {
    const sync = () => {
      const today = plannerDate();
      if (useAppStore.getState().currentDate !== today) {
        useAppStore.getState().setCurrentDate(today);
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    const id = window.setInterval(sync, 30_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);
    sync();
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
    };
  }, []);
}
