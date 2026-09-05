import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, Send, Copy, Check, Unlink, RefreshCw } from 'lucide-react';
import { useTelegramLink, deepLink, BOT_USERNAME, type LinkCode } from '@/features/telegram/useTelegramLink';
import { useIsPremium } from '@/lib/features';

/**
 * 텔레그램 연결 — 앱에서 1회용 코드를 받아 봇에 /start 로 넘기면 계정이 묶인다.
 * 연결되면 모든 알림이 웹푸시 대신 텔레그램으로 가고, 습관 체크·회고를 대화로 할 수 있다.
 */
export default function TelegramSettings() {
  const navigate = useNavigate();
  const isPremium = useIsPremium();
  const { link, linked, loading, busy, createCode, unlink } = useTelegramLink();
  const [code, setCode] = useState<LinkCode | null>(null);
  const [copied, setCopied] = useState(false);
  const [remain, setRemain] = useState(0);

  // 코드 만료 카운트다운
  useEffect(() => {
    if (!code) { setRemain(0); return; }
    const tick = () => setRemain(Math.max(0, Math.ceil((code.expiresAtMs - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [code]);

  // 연결이 완료되면 화면에 남은 코드를 지운다
  useEffect(() => { if (linked) setCode(null); }, [linked]);

  const onCreate = async () => {
    try {
      setCode(await createCode());
      setCopied(false);
    } catch (e: any) {
      toast.error(e?.message ?? '코드를 만들지 못했어요');
    }
  };

  const onCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      toast.success('코드를 복사했어요');
    } catch {
      toast.error('복사에 실패했어요. 직접 입력해 주세요.');
    }
  };

  const onUnlink = async () => {
    if (!window.confirm('텔레그램 연결을 해제할까요? 알림은 다시 앱 푸시로 갑니다.')) return;
    try {
      await unlink();
      toast('연결을 해제했어요');
    } catch (e: any) {
      toast.error(e?.message ?? '해제에 실패했어요');
    }
  };

  const url = code ? deepLink(code.code) : null;
  const expired = !!code && remain <= 0;

  return (
    <div
      className="standalone-shell page-pad space-y-6 pb-8"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-[var(--fg-muted)]" aria-label="뒤로">
          <ChevronLeft size={22} />
        </button>
        <h2 className="page-title">텔레그램 연결</h2>
      </div>

      {!isPremium ? (
        <p className="card-flat p-4 text-sm leading-relaxed text-[var(--fg-muted)]">
          텔레그램 연동은 가입·승인된 사용자에게 제공돼요.
        </p>
      ) : loading ? (
        <p className="card-flat p-4 text-sm text-[var(--fg-muted)]">불러오는 중…</p>
      ) : linked ? (
        <>
          <div className="card-flat space-y-1 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--fg-primary)]">
              <Send size={16} className="text-[var(--leaf)]" />
              연결됨{link?.username ? ` · @${link.username}` : ''}
            </p>
            <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
              이제 앱을 열지 않아도 텔레그램에서 습관을 체크하고 회고를 쓸 수 있어요.
              모든 알림도 웹푸시 대신 텔레그램으로 갑니다.
            </p>
          </div>

          <div className="card-flat space-y-2 p-4">
            <p className="text-xs font-medium text-[var(--fg-muted)]">봇에서 쓸 수 있는 명령</p>
            <ul className="space-y-1 text-xs text-[var(--fg-muted)]">
              <li><code className="text-[var(--fg-primary)]">/today</code> — 오늘 습관 체크</li>
              <li><code className="text-[var(--fg-primary)]">/reflect</code> — 저녁 회고 쓰기</li>
              <li><code className="text-[var(--fg-primary)]">/coach</code> — AI 코치 한마디</li>
              <li><code className="text-[var(--fg-primary)]">/weekly</code> — 이번 주 인사이트</li>
              <li><code className="text-[var(--fg-primary)]">/settings</code> — 알림 켜고 끄기</li>
            </ul>
            <p className="pt-1 text-[11px] text-[var(--fg-faint)]">
              “오늘”, “회고”처럼 한글로 보내도 같은 명령이 실행돼요.
            </p>
          </div>

          <button
            onClick={onUnlink}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--fg-muted)] active:opacity-70 disabled:opacity-50"
          >
            <Unlink size={16} /> 연결 해제
          </button>
        </>
      ) : (
        <>
          <div className="card-flat space-y-2 p-4">
            <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
              텔레그램을 연결하면 앱에 들어오지 않아도 습관 체크·회고·AI 코치를 쓸 수 있어요.
              리마인더도 텔레그램으로 와서, 알림에서 바로 체크할 수 있습니다.
            </p>
          </div>

          {!code ? (
            <button
              onClick={onCreate}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--leaf)] px-4 py-3.5 text-sm font-medium text-white active:opacity-80 disabled:opacity-50"
            >
              <Send size={16} /> 연결 코드 받기
            </button>
          ) : (
            <div className="card-flat space-y-3 p-4">
              <div className="text-center">
                <p className="text-[11px] text-[var(--fg-faint)]">연결 코드</p>
                <p className="py-1 font-mono text-[32px] font-semibold tracking-[0.2em] text-[var(--fg-primary)]">
                  {code.code}
                </p>
                <p className={`text-[11px] ${expired ? 'text-[var(--bloom)]' : 'text-[var(--fg-faint)]'}`}>
                  {expired ? '만료됐어요. 새 코드를 받아주세요.' : `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')} 후 만료`}
                </p>
              </div>

              {url && !expired && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--leaf)] px-4 py-3 text-sm font-medium text-white active:opacity-80"
                >
                  <Send size={16} /> 텔레그램에서 열기
                </a>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onCopy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--fg-muted)] active:opacity-70"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} 코드 복사
                </button>
                <button
                  onClick={onCreate}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs text-[var(--fg-muted)] active:opacity-70 disabled:opacity-50"
                >
                  <RefreshCw size={14} /> 새 코드
                </button>
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--fg-faint)]">
                {BOT_USERNAME
                  ? <>텔레그램에서 <b>@{BOT_USERNAME}</b> 을 찾아 <code>/start {code.code}</code> 를 보내도 돼요.</>
                  : <>텔레그램에서 봇을 찾아 <code>/start {code.code}</code> 를 보내주세요.</>}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
