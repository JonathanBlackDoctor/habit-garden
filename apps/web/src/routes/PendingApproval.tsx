import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOutUser } from '@/lib/auth';
import { useAppStore } from '@/lib/store';
import { CheckSquare, Flower2, Sparkles, HandHeart, Shield, Mail } from 'lucide-react';

export default function PendingApproval() {
  const user    = useAppStore((s) => s.user);
  const profile = useAppStore((s) => s.profile);
  const authLoading = useAppStore((s) => s.authLoading);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.status === 'approved') {
      navigate('/', { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  if (profile?.status === 'rejected') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg-base)] px-6">
        <div className="text-5xl">🚫</div>
        <p className="text-base text-[var(--fg-primary)]">접근이 거부되었습니다.</p>
        <button
          onClick={() => signOutUser()}
          className="text-sm text-[var(--fg-muted)] underline"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] px-5 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        {/* 상태 헤더 */}
        <div className="flex flex-col items-center gap-3 pt-4 text-center">
          <div className="text-5xl">⏳</div>
          <h2 className="text-lg font-semibold text-[var(--fg-primary)]">승인 대기 중입니다</h2>
          <p className="max-w-xs text-sm text-[var(--fg-muted)]">
            가입 신청이 접수되었습니다. 관리자가 승인하면 이 화면이 자동으로 메인으로 바뀝니다.
          </p>
          {user?.email && (
            <p className="text-[11px] text-[var(--fg-faint)]">로그인 계정: {user.email}</p>
          )}
        </div>

        {/* 빠른 승인 안내 */}
        <section className="rounded-[var(--radius)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-start gap-3">
            <Mail size={18} className="mt-0.5 shrink-0 text-[var(--leaf)]" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--fg-primary)]">빠른 승인을 원하시면</p>
              <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                <span className="break-all text-[var(--fg-primary)]">alpaomegastartend@gmail.com</span> 으로
                "습관 정원 가입 신청" 한 줄만 보내주시면 확인 후 바로 승인해드립니다.
              </p>
            </div>
          </div>
        </section>

        {/* 누가 만들었는지 */}
        <section className="rounded-[var(--radius)] bg-[var(--bg-surface)] p-4 text-xs leading-relaxed text-[var(--fg-muted)] shadow-[var(--shadow-sm)]">
          <p>
            안녕하세요. 이 앱은 <span className="font-medium text-[var(--fg-primary)]">조나단</span>(alpaomegastartend@gmail.com)이 가족·지인과 함께 쓰려고 개인적으로 만든 프로젝트입니다. 광고도 없고, 데이터는 본인에게만 보입니다.
          </p>
        </section>

        {/* 앱 소개 */}
        <section className="rounded-[var(--radius)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
          <h3 className="mb-2 text-sm font-medium text-[var(--fg-primary)]">습관 정원이란</h3>
          <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
            매일 작은 습관을 체크하면 포인트가 쌓이고, 그 포인트로 가상의 정원에 식물을 심어 키우는 PWA입니다. 게임처럼 가볍게 습관을 들이고, AI 코치가 매일의 패턴을 짧게 짚어줍니다.
          </p>
        </section>

        {/* 주요 기능 */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--fg-primary)]">주요 기능</h3>
          <FeatureRow
            icon={<CheckSquare size={16} className="text-[var(--leaf)]" />}
            title="습관 체크"
            desc="매일 정한 습관을 0~5점으로 기록하면 가중치에 따라 포인트가 쌓입니다."
          />
          <FeatureRow
            icon={<Flower2 size={16} className="text-[var(--leaf)]" />}
            title="정원 가꾸기"
            desc="모은 포인트로 씨앗을 심어 식물을 키우고, 만개하면 수확 보상을 얻어요."
          />
          <FeatureRow
            icon={<Sparkles size={16} className="text-[var(--leaf)]" />}
            title="AI 일일 피드백 & 회고"
            desc="하루를 마무리하며 한 줄 회고를 적으면 AI가 짧은 코칭을 돌려드립니다."
          />
          <FeatureRow
            icon={<HandHeart size={16} className="text-[var(--leaf)]" />}
            title="신앙 기능 (선택)"
            desc="경건·기도제목 메뉴는 기본 OFF이며, 더보기 → '신앙 기능' 토글로 켤 수 있습니다."
          />
        </section>

        {/* 데이터 안전성 */}
        <section className="rounded-[var(--radius)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-start gap-3">
            <Shield size={18} className="mt-0.5 shrink-0 text-[var(--leaf)]" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--fg-primary)]">데이터 안전성</p>
              <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                Firebase 보안 규칙으로 본인 데이터는 본인 계정에서만 읽고 쓸 수 있습니다. 관리자도 다른 사용자의 습관·기도·회고 내용을 들여다보지 않습니다.
              </p>
            </div>
          </div>
        </section>

        <button
          onClick={() => signOutUser()}
          className="mt-2 self-center text-sm text-[var(--fg-muted)] underline"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="space-y-0.5">
        <p className="text-sm text-[var(--fg-primary)]">{title}</p>
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{desc}</p>
      </div>
    </div>
  );
}
