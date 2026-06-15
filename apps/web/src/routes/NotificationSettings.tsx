import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { ChevronLeft, Bell, BellRing, Sparkles, HandHeart, BarChart2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { enablePushNotifications, disablePushNotifications, isFcmEnabled } from '@/lib/fcm';
import { useFaithEnabled, useIsPremium } from '@/lib/features';
import ToggleRow from '@/components/ToggleRow';

/**
 * 알림 설정 — 푸시 알림 마스터 토글 + 타입별 on/off + 기도 알림 시각을 한 화면에 묶는다.
 * More 화면의 "푸시 알림" 행에서 진입.
 */
export default function NotificationSettings() {
  const navigate = useNavigate();
  const uid = useAppStore((s) => s.uid);
  const prayerReminder = useAppStore((s) => s.settings?.prayerReminder);
  const notif = useAppStore((s) => s.settings?.notifications);
  const faithEnabled = useFaithEnabled();
  const isPremium = useIsPremium();
  const [push, setPush] = useState(false);

  useEffect(() => { setPush(isFcmEnabled()); }, []);

  const onPushToggle = async () => {
    if (!uid) return;
    if (push) { await disablePushNotifications(); setPush(false); }
    else      { const t = await enablePushNotifications(uid); if (t) setPush(true); }
  };

  const savePrayerReminder = async (enabled: boolean, hour: number) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'settings', 'main'),
      { prayerReminder: { enabled, hour }, updatedAt: serverTimestamp() }, { merge: true });
    if (enabled) toast.success(`🙏 매일 ${hourLabel(hour)}에 기도 알림을 보내드릴게요`);
  };

  const saveNotifPref = async (
    key: 'habitReminder' | 'morningBrief' | 'prayerWeekly' | 'progressWeekly',
    value: boolean,
  ) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'settings', 'main'),
      { notifications: { [key]: value }, updatedAt: serverTimestamp() }, { merge: true });
  };

  return (
    <div
      className="min-h-dvh bg-[var(--bg-base)] p-4 space-y-4 pb-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]">
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-semibold text-[var(--fg-primary)]">알림 설정</h2>
      </div>

      {!isPremium ? (
        <p className="card p-4 text-sm leading-relaxed text-[var(--fg-muted)]">
          푸시 알림은 가입·승인된 사용자에게 제공돼요. 가입하면 시간대별 리마인더와
          모닝 브리프를 받아볼 수 있어요.
        </p>
      ) : (
        <>
          {/* 마스터 토글 */}
          <div className="rounded-[var(--radius)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
            <ToggleRow
              icon={<Bell size={18} className="text-[var(--leaf)]" />}
              label="푸시 알림"
              desc="아래 알림을 받으려면 먼저 켜주세요 (FCM)"
              value={push}
              onToggle={onPushToggle}
            />
          </div>

          {/* 타입별 on/off — 푸시가 켜진 경우에만 노출 */}
          {push ? (
            <>
              <p className="px-1 pt-1 text-[11px] font-medium text-[var(--fg-faint)]">알림 종류</p>
              <div className="rounded-[var(--radius)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] divide-y divide-[var(--leaf-soft)]">
                <ToggleRow
                  icon={<BellRing size={18} className="text-[var(--leaf)]" />}
                  label="습관 리마인더"
                  desc="시간대별 미체크 습관 알림 (하루 최대 3회)"
                  value={notif?.habitReminder ?? true}
                  onToggle={() => saveNotifPref('habitReminder', !(notif?.habitReminder ?? true))}
                />
                <ToggleRow
                  icon={<Sparkles size={18} className="text-[var(--leaf)]" />}
                  label="모닝 브리프"
                  desc="매일 아침 6시 오늘의 핵심 습관 알림"
                  value={notif?.morningBrief ?? true}
                  onToggle={() => saveNotifPref('morningBrief', !(notif?.morningBrief ?? true))}
                />
                <ToggleRow
                  icon={<BarChart2 size={18} className="text-[var(--leaf)]" />}
                  label="주간 진척 요약"
                  desc="매주 일요일 저녁 한 주의 평균·달성·스트릭 요약"
                  value={notif?.progressWeekly ?? true}
                  onToggle={() => saveNotifPref('progressWeekly', !(notif?.progressWeekly ?? true))}
                />
                {faithEnabled && (
                  <>
                    <ToggleRow
                      icon={<HandHeart size={18} className="text-[var(--leaf)]" />}
                      label="기도 알림"
                      desc="설정한 시간에 남은 기도를 알려드려요"
                      value={prayerReminder?.enabled ?? false}
                      onToggle={() => savePrayerReminder(!(prayerReminder?.enabled ?? false), prayerReminder?.hour ?? 7)}
                    />
                    {prayerReminder?.enabled && (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="flex-1 pl-[30px] text-xs text-[var(--fg-muted)]">알림 시간</span>
                        <select
                          value={prayerReminder.hour ?? 7}
                          onChange={(e) => savePrayerReminder(true, Number(e.target.value))}
                          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 py-1.5 text-xs outline-none"
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{hourLabel(h)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <ToggleRow
                      icon={<HandHeart size={18} className="text-[var(--leaf)]" />}
                      label="주간 기도 회고"
                      desc="매주 일요일 저녁 회고 도착 알림"
                      value={notif?.prayerWeekly ?? true}
                      onToggle={() => saveNotifPref('prayerWeekly', !(notif?.prayerWeekly ?? true))}
                    />
                  </>
                )}
              </div>
              <p className="px-1 text-[11px] leading-snug text-[var(--fg-faint)]">
                앱으로 설치하면 푸시 알림이 더 안정적으로 도착해요. 알림이 오지 않으면
                기기 설정에서 알림 권한이 허용돼 있는지 확인해주세요.
              </p>
            </>
          ) : (
            <p className="px-1 text-[11px] leading-snug text-[var(--fg-faint)]">
              푸시 알림을 켜면 습관 리마인더·모닝 브리프 등 알림 종류를 개별로 켜고 끌 수 있어요.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function hourLabel(h: number): string {
  if (h === 0) return '자정';
  if (h === 12) return '정오';
  return h < 12 ? `오전 ${h}시` : `오후 ${h - 12}시`;
}
