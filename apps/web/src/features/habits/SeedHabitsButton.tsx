import { useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { seedDefaultHabits } from '@/lib/seed';
import { cn } from '@/lib/utils';

/**
 * '기본 습관 담기' CTA — 빈 화면(오늘·습관 탭)에서 1탭으로 기본 습관을 시작하게 한다.
 * 멱등 가드: 이미 습관이 있으면(더블탭·경합) 중복 시드하지 않는다.
 */
export default function SeedHabitsButton({ className }: { className?: string }) {
  const uid = useAppStore((s) => s.uid);
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (!uid || loading) return;
    setLoading(true);
    try {
      const existing = await getDocs(query(collection(db, 'users', uid, 'habits'), limit(1)));
      if (!existing.empty) {
        toast('이미 습관이 있어요');
        return;
      }
      const n = await seedDefaultHabits(uid);
      toast.success(`기본 습관 ${n}개를 담았어요 🌱`);
    } catch {
      toast.error('습관을 담지 못했어요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--leaf)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-all hover:opacity-95 active:scale-95 disabled:opacity-60',
        className,
      )}
    >
      <Sprout size={16} /> {loading ? '담는 중…' : '기본 습관 담기'}
    </button>
  );
}
