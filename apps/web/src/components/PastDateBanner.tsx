import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { formatKoreanDate } from '@/lib/dayBoundary';

export default function PastDateBanner({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[var(--radius)] bg-[var(--bloom-soft)] px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-[var(--bloom)]">
        <Clock size={16} />
        <span>
          <span className="font-medium">{formatKoreanDate(date)}</span> 편집 중
        </span>
      </div>
      <Link
        to="/progress"
        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--fg-primary)] shadow-sm"
      >
        달력으로
      </Link>
    </div>
  );
}
