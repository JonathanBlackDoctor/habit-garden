import { Trophy } from 'lucide-react';
import { useWeeklyQuest, type QuestState } from './useWeeklyQuest';
import { motion } from 'framer-motion';

function QuestRow({ q }: { q: QuestState }) {
  const { def, current, goal, completed } = q;
  const ratio = goal === 0 ? 0 : Math.min(current / goal, 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Trophy size={14} className={completed ? 'text-[var(--bloom)]' : 'text-[var(--leaf)]'} />
        <p className="flex-1 text-sm font-medium text-[var(--fg-primary)]">{def.title}</p>
        <span className="text-xs font-medium tabular-nums text-[var(--fg-muted)]">
          {Math.min(current, goal)}/{goal}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--leaf-soft)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ type: 'spring', stiffness: 110, damping: 22 }}
          className="h-full rounded-full"
          style={{ background: completed ? 'var(--bloom)' : 'var(--leaf)' }}
        />
      </div>
      <p className="text-[10px] text-[var(--fg-faint)]">
        보상: ✦{def.reward.points}P
        {def.reward.freezeTokens ? ` · 🧊${def.reward.freezeTokens}` : ''}
        {completed && ' · 완료!'}
      </p>
    </div>
  );
}

export default function WeeklyQuestCard() {
  const { quests } = useWeeklyQuest();

  if (quests.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-3 space-y-3"
    >
      <p className="text-xs text-[var(--fg-muted)]">이번 주 퀘스트</p>
      {quests.map((q) => (
        <QuestRow key={q.def.id} q={q} />
      ))}
    </motion.div>
  );
}
