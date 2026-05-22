import { Brain, RefreshCw } from 'lucide-react';
import { useWeeklyCoach } from './useAICoach';

export default function WeeklyInsightCard() {
  const { data, loading, refresh } = useWeeklyCoach();

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-[var(--fg-primary)]">
          <Brain size={14} className="text-[var(--leaf)]" />
          이번 주 인사이트
        </h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] disabled:opacity-40"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          {data ? '다시' : '받기'}
        </button>
      </div>
      {data ? (
        <div className="space-y-1.5 text-xs">
          <p className="text-[var(--fg-primary)]">
            <span className="font-medium text-[var(--leaf)]">잘된 점</span> · {data.strengths}
          </p>
          <p className="text-[var(--fg-primary)]">
            <span className="font-medium text-[var(--sky)]">패턴</span> · {data.pattern}
          </p>
          <p className="text-[var(--fg-primary)]">
            <span className="font-medium text-[var(--bloom)]">다음 주</span> · {data.recommendation}
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--fg-faint)]">
          AI 코치에게 이번 주를 분석해달라고 요청해보세요.
        </p>
      )}
    </div>
  );
}
