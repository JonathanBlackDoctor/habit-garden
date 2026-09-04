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

  // ── 온보딩(웰컴 + 인터랙티브 가이드) ──
  // 첫 실행 시 useOnboardingTrigger 가 자동으로, 더보기에서 수동으로 연다.
  // 완료/건너뛰기 시 onboardingState.markOnboarded() 는 플로우 컴포넌트가 호출한다.
  onboardingOpen: boolean;
  startOnboarding: () => void;
  closeOnboarding: () => void;

  // ── 기도 튜토리얼 (신앙 기능 ON 시) ──
  // 더보기에서 신앙 기능을 켤 때마다 기도 가이드를 띄운다(매번 진행).
  prayerTourOpen: boolean;
  startPrayerTour: () => void;
  closePrayerTour: () => void;

  // ── 오늘 탭 위젯 편집 모드 ──
  // 더보기 설정에서 버튼을 누르면 오늘 탭으로 이동하면서 편집 모드가 자동으로 열린다.
  widgetEditOpen: boolean;
  openWidgetEdit: () => void;
  closeWidgetEdit: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentDate:     plannerDate(),
  setCurrentDate:  (date) => set({ currentDate: date }),
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

  onboardingOpen: false,
  startOnboarding: () => set({ onboardingOpen: true }),
  closeOnboarding: () => set({ onboardingOpen: false }),

  prayerTourOpen: false,
  startPrayerTour: () => set({ prayerTourOpen: true }),
  closePrayerTour: () => set({ prayerTourOpen: false }),

  widgetEditOpen: false,
  openWidgetEdit: () => set({ widgetEditOpen: true }),
  closeWidgetEdit: () => set({ widgetEditOpen: false }),
}));
