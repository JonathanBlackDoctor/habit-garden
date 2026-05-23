import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// 브라우저 SpeechRecognition 최소 타입 (표준 lib.dom에 아직 없음)
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * 음성으로 받아 적어 onTranscript로 넘긴다 (한국어).
 * 자연어 파싱(parseQuickAdd)과 결합하면 타이핑 없이 분류된 기도제목을 만든다.
 * 지원하지 않는 브라우저에서는 렌더링하지 않는다.
 */
export function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() != null);
    return () => { recRef.current?.stop(); };
  }, []);

  if (!supported) return null;

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.continuous = false;
    rec.interimResults = false;
    let buf = '';
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) buf += e.results[i][0].transcript + ' ';
      }
    };
    rec.onerror = (e: any) => {
      setRecording(false);
      if (e?.error === 'not-allowed') toast.error('마이크 권한이 필요합니다.');
    };
    rec.onend = () => {
      setRecording(false);
      const text = buf.trim();
      if (text) onTranscript(text);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stop = () => recRef.current?.stop();

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      aria-label={recording ? '음성 입력 중지' : '음성으로 추가'}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[var(--radius)] px-3 transition-colors',
        recording
          ? 'animate-pulse bg-[var(--bloom)] text-white'
          : 'border border-[var(--border)] bg-white text-[var(--fg-muted)]'
      )}
    >
      {recording ? <Square size={16} /> : <Mic size={16} />}
    </button>
  );
}
