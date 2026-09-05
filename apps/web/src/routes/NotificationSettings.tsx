import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { ChevronLeft, Bell, BellRing, Sparkles, HandHeart, BarChart2, Send, NotebookPen, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { enablePushNotifications, disablePushNotifications, isFcmEnabled } from '@/lib/fcm';
import { useFaithEnabled, useIsPremium } from '@/lib/features';
import ToggleRow from '@/components/ToggleRow';
import { useTelegramLink } from '@/features/telegram/useTelegramLink';

/**
 * 알림 설정 — 발송 채널(웹푸시 / 텔레그램) + 타입별 on/off + 기도 알림 시각을 한 화면에 묶는다.
 * More 화면의 "푸시 알림" 행에서 진입.
 *
 * 텔레그램이 연결돼 있으면 서버(notifyUser)가 웹푸시 대신 텔레그램으로만 보낸다.
 * 그래서 타입별 토글은 FCM 이 꺼져 있어도 노출해야 한다.
 */
export default function NotificationSettings() {
  const navigate = useNavigate();
  const uid = useAppStore((s) => s.uid);
  const prayerReminder = useAppStore((s) => s.settings?.prayerReminder);
  const notif = useAppStore((s) => s.settings?.notifications);
  const faithEnabled = useFaithEnabled();
  const isPremium = useIsPremium();
  const { linked: telegramLinked, link: telegramLink } = useTelegramLink();
  const [push, setPush] = useState(false);

  // 알림 종류 토글은 어느 채널로든 알림이 갈 때만 의미가 있다.
  const anyChannel = push || telegramLinked;

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
    key: 'habitReminder' | 'reflectionReminder' | 'morningBrief' | 'prayerWeekly' | 'progressWeekly',
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
        <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-[var(--fg-primary)]">알림 설정</h2>
      </div>

      {!isPremium ? (
        <p className="card-flat p-4 text-sm leading-relaxed text-[var(--fg-muted)]">
          푸시 알림은 가입·승인된 사용자에게 제공돼요. 가입하면 시간대별 리마인더와
          모닝 브리프를 받아볼 수 있어요.
        </p>
      ) : (
        <>
          {/* 발송 채널 */}
          <p className="px-1 text-[11px] font-medium text-[var(--fg-faint)]">받는 방법</p>
          <div className="rounded-[var(--radius)] bg-[var(--bg-surface)] divide-y divide-[var(--leaf-soft)]">
            <ToggleRow
              icon={<Bell size={18} className="text-[var(--leaf)]" />}
              label="웹 푸시 알림"
              desc={telegramLinked
                ? '텔레그램 연결 중에는 사용하지 않아요'
                : '아래 알림을 받으려면 먼저 켜주세요 (FCM)'}
              value={push}
              onToggle={onPushToggle}
            />
            <button
              onClick={() => navigate('/settings/telegram')}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:opacity-70"
            >
              <Send size={18} className="text-[var(--leaf)]" />
              <div className="flex-1">
                <p className="text-sm text-[var(--fg-primary)]">텔레그램</p>
                <p className="text-[10px] text-[var(--fg-faint)]">
                  {telegramLinked
                    ? `연결됨${telegramLink?.username ? ` · @${telegramLink.username}` : ''} — 앱 없이 체크·회고`
                    : '앱을 열지 않고 봇에서 체크·회고하기'}
                </p>
              </div>
              <ChevronRight size={16} className="text-[var(--fg-faint)]" />
            </button>
          </div>

          {telegramLinked && (
            <p className="px-1 text-[11px] leading-snug text-[var(--fg-faint)]">
              텔레그램이 연결돼 있어 모든 알림이 텔레그램으로만 갑니다. 아래 설정은 그대로 적용돼요.
            </p>
          )}

          {/* 타입별 on/off — 어느 채널이든 알림이 갈 때만 노출 */}
          {anyChannel ? (
            <>
              <p className="px-1 pt-1 text-[11px] font-medium text-[var(--fg-faint)]">알림 종류</p>
              <div className="rounded-[var(--radius)] bg-[var(--bg-surface)] divide-y divide-[var(--leaf-soft)]">
                <ToggleRow
                  icon={<BellRing size={18} className="text-[var(--leaf)]" />}
                  label="습관 리마인더"
                  desc="시간대별 미체크 습관 알림 (하루 최대 3회)"
                  value={notif?.habitReminder ?? true}
                  onToggle={() => saveNotifPref('habitReminder', !(notif?.habitReminder ?? true))}
                />
                <ToggleRow
                  icon={<NotebookPen size={18} className="text-[var(--leaf)]" />}
                  label="저녁 회고 알림"
                  desc="밤 10시, 오늘 회고를 아직 안 썼다면 알려드려요"
                  value={notif?.reflectionReminder ?? true}
                  onToggle={() => saveNotifPref('reflectionReminder', !(notif?.reflectionReminder ?? true))}
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
                {telegramLinked
                  ? '알림이 오지 않으면 텔레그램에서 봇을 차단하지 않았는지 확인해주세요.'
                  : '앱으로 설치하면 푸시 알림이 더 안정적으로 도착해요. 알림이 오지 않으면 기기 설정에서 알림 권한이 허용돼 있는지 확인해주세요.'}
              </p>
            </>
          ) : (
            <p className="px-1 text-[11px] leading-snug text-[var(--fg-faint)]">
              웹 푸시를 켜거나 텔레그램을 연결하면 습관 리마인더·모닝 브리프 등 알림 종류를 개별로 켜고 끌 수 있어요.
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
