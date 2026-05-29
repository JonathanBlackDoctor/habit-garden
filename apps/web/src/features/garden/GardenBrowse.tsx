import { useEffect, useState } from 'react';
import GardenView from '@/features/garden/GardenView';
import PlantSVG from '@/features/garden/PlantSVG';
import { useGardenList, useOtherGarden } from '@/features/garden/usePublicGardens';
import { saveNickname } from '@/lib/features';
import { PLANT_SPECIES } from 'shared/types/firestore';
import type { GardenState, PlantInstance } from 'shared/types/firestore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Users, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const speciesOf = (id: string) => PLANT_SPECIES.find((s) => s.id === id);
const plantedMillis = (p: PlantInstance) => {
  const t = p.plantedAt as { toMillis?: () => number; seconds?: number } | undefined;
  return t?.toMillis?.() ?? (t?.seconds ?? 0) * 1000;
};

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="rounded-full bg-[var(--leaf-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--leaf-strong,var(--leaf))] tabular-nums">
      Lv.{level}
    </span>
  );
}

interface GardenBrowseProps {
  selfUid: string;
  sandbox: boolean;
  isAnonymous: boolean;
  level: number;
  gardenState: GardenState;
  currentNickname: string;
}

/** 둘러보기 탭: 닉네임 설정 + 다른 사용자 정원 목록/열람. */
export default function GardenBrowse({
  selfUid, sandbox, isAnonymous, level, gardenState, currentNickname,
}: GardenBrowseProps) {
  const [browseUid, setBrowseUid] = useState<string | null>(null);
  const { gardens, loading } = useGardenList();
  const { garden: otherGarden, loading: otherLoading } = useOtherGarden(browseUid);

  // 닉네임 입력 (store 값 기준, 외부 변경 시 동기화)
  const [nickInput, setNickInput] = useState(currentNickname);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setNickInput(currentNickname); }, [currentNickname]);

  const trimmed = nickInput.trim();
  const dirty = trimmed !== currentNickname.trim();

  const onSave = async () => {
    setSaving(true);
    try {
      await saveNickname({
        uid: selfUid, sandbox, isAnonymous,
        nickname: trimmed, level, gardenState,
      });
      toast(trimmed ? `닉네임을 "${trimmed}"(으)로 저장했어요.` : '닉네임을 비웠어요. 둘러보기에서 내 정원이 숨겨집니다.');
    } catch (e) {
      toast.error('저장 실패: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── 상세 보기 ──
  if (browseUid) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setBrowseUid(null)} className="text-[var(--fg-muted)]" aria-label="목록으로">
            <ChevronLeft size={20} />
          </button>
          {otherGarden ? (
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold text-[var(--fg-primary)] truncate">{otherGarden.nickname}</p>
              <LevelBadge level={otherGarden.level ?? 1} />
              {otherGarden.uid === selfUid && (
                <span className="rounded-full bg-[var(--bloom)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">나</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">정원을 불러오는 중…</p>
          )}
        </div>
        {otherLoading ? (
          <p className="py-12 text-center text-sm text-[var(--fg-faint)]">불러오는 중…</p>
        ) : otherGarden ? (
          <GardenView gardenState={otherGarden.gardenState} />
        ) : (
          <p className="py-12 text-center text-sm text-[var(--fg-faint)]">정원을 찾을 수 없어요.</p>
        )}
      </div>
    );
  }

  // ── 목록 보기 ──
  return (
    <div className="space-y-4">
      {/* 닉네임 입력 */}
      <div className="card p-4 space-y-2">
        <p className="text-sm font-semibold text-[var(--fg-primary)]">내 닉네임</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nickInput}
            maxLength={20}
            onChange={(e) => setNickInput(e.target.value)}
            placeholder="닉네임 입력"
            className="flex-1 rounded-lg border border-[var(--leaf-soft)] bg-white px-3 py-2 text-sm text-[var(--fg-primary)] outline-none focus:border-[var(--leaf)]"
          />
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
        <p className="text-[11px] text-[var(--fg-faint)] leading-relaxed">
          {currentNickname.trim()
            ? '둘러보기에서 다른 사용자에게 표시돼요. 중복 가능.'
            : '닉네임을 입력하면 둘러보기에 내 정원이 공개돼요. 설정 전에는 다른 사람에게 보이지 않아요. 중복 가능.'}
        </p>
        {(sandbox || isAnonymous) && (
          <p className="text-[11px] text-amber-600">
            {sandbox ? '샌드박스 모드에서는 정원이 공개되지 않습니다.' : '게스트 계정은 정원이 공개되지 않습니다.'}
          </p>
        )}
      </div>

      {/* 목록 */}
      <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--fg-primary)]">
        <Users size={15} /> 다른 정원 둘러보기
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--fg-faint)]">불러오는 중…</p>
      ) : gardens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--fg-faint)]">
          <Sprout size={28} className="text-[var(--leaf-soft)]" opacity={0.6} />
          <p className="text-sm">아직 공개된 정원이 없어요.</p>
          <p className="text-xs">닉네임을 설정한 사용자가 여기 나타납니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {gardens.map((g) => {
            const preview = [...(g.gardenState?.plants ?? [])]
              .sort((a, b) => plantedMillis(b) - plantedMillis(a))
              .slice(0, 3);
            const count = g.gardenState?.plants?.length ?? 0;
            const isSelf = g.uid === selfUid;
            return (
              <button
                key={g.uid}
                onClick={() => setBrowseUid(g.uid)}
                className="flex w-full items-center gap-3 rounded-lg border border-[var(--leaf-soft)] bg-white/60 p-3 text-left transition-colors hover:border-[var(--leaf)]"
              >
                <div className="flex -space-x-2">
                  {preview.length > 0 ? preview.map((p) => (
                    <PlantSVG
                      key={p.id}
                      speciesId={p.speciesId}
                      stage={p.stage}
                      withered={!!p.witheredSince}
                      rarity={speciesOf(p.speciesId)?.rarity}
                      size={40}
                      decorative={false}
                    />
                  )) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--leaf-soft)]/50">
                      <Sprout size={16} className="text-[var(--leaf-soft)]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('font-medium text-[var(--fg-primary)] truncate')}>{g.nickname}</p>
                    <LevelBadge level={g.level ?? 1} />
                    {isSelf && (
                      <span className="rounded-full bg-[var(--bloom)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">나</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--fg-faint)] tabular-nums">🌱 {count}그루</p>
                </div>
                <ChevronLeft size={16} className="rotate-180 text-[var(--fg-faint)]" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
