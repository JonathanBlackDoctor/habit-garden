import { useAppStore } from '@/lib/store';

/**
 * 샌드박스(테스트) 모드일 때 화면 최상단에 고정 표시되는 경고 배너.
 * 실제 데이터 모드와 헷갈리지 않도록 모든 화면 위에 떠 있으며,
 * 탭하면 즉시 실제 모드로 복귀한다. owner만 모드를 켤 수 있다.
 */
export default function SandboxBanner() {
  const sandbox = useAppStore((s) => s.sandbox);
  const setSandbox = useAppStore((s) => s.setSandbox);
  if (!sandbox) return null;

  return (
    <button
      onClick={() => setSandbox(false)}
      className="fixed inset-x-0 top-0 z-[100] w-full bg-amber-500 px-3 text-center text-[11px] font-semibold text-white shadow-md"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4px)', paddingBottom: '4px' }}
    >
      🧪 테스트 모드 — 실제 데이터가 아닙니다 · 탭하여 종료
    </button>
  );
}
