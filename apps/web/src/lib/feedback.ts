/**
 * 즉각 피드백 유틸 — 햅틱(진동) + 사운드(Web Audio 합성).
 * 외부 자산 없이 동작. localStorage 토글로 사용자 제어.
 */

const HAPTIC_KEY = 'feedback.haptic';
const SOUND_KEY  = 'feedback.sound';

export type FeedbackKind = 'check' | 'achieve' | 'perfect' | 'combo' | 'levelup';

export function isHapticEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(HAPTIC_KEY);
  return v === null ? true : v === '1';
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(SOUND_KEY);
  return v === null ? false : v === '1'; // 기본 off — 자동재생 정책 대응
}

export function setHapticEnabled(on: boolean) {
  localStorage.setItem(HAPTIC_KEY, on ? '1' : '0');
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? '1' : '0');
}

// ── 햅틱 ───────────────────────────────────────────────
const HAPTIC_PATTERNS: Record<FeedbackKind, number | number[]> = {
  check:   10,
  achieve: [10, 30, 10],
  perfect: [12, 30, 12, 30, 18],
  combo:   [8, 20, 8],
  levelup: [20, 40, 20, 40, 30],
};

function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch {}
}

// ── 사운드 (Web Audio 합성) ──────────────────────────────
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try { audioCtx = new Ctor(); return audioCtx; } catch { return null; }
}

interface Tone { freq: number; dur: number; delay?: number; type?: OscillatorType; gain?: number }

const SOUND_PATTERNS: Record<FeedbackKind, Tone[]> = {
  check:   [{ freq: 880, dur: 0.08, type: 'sine', gain: 0.08 }],
  achieve: [
    { freq: 660, dur: 0.10, type: 'sine', gain: 0.10 },
    { freq: 990, dur: 0.16, delay: 0.08, type: 'sine', gain: 0.10 },
  ],
  perfect: [
    { freq: 660, dur: 0.10, type: 'sine', gain: 0.10 },
    { freq: 880, dur: 0.10, delay: 0.08, type: 'sine', gain: 0.10 },
    { freq: 1320, dur: 0.22, delay: 0.16, type: 'sine', gain: 0.12 },
  ],
  combo: [
    { freq: 1175, dur: 0.05, type: 'triangle', gain: 0.07 },
    { freq: 1480, dur: 0.08, delay: 0.05, type: 'triangle', gain: 0.07 },
  ],
  levelup: [
    { freq: 523, dur: 0.10, type: 'sine', gain: 0.10 },
    { freq: 659, dur: 0.10, delay: 0.10, type: 'sine', gain: 0.10 },
    { freq: 784, dur: 0.10, delay: 0.20, type: 'sine', gain: 0.10 },
    { freq: 1047, dur: 0.30, delay: 0.30, type: 'sine', gain: 0.12 },
  ],
};

function playTones(tones: Tone[]) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
  const now = ctx.currentTime;
  for (const t of tones) {
    const start = now + (t.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.value = t.freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(t.gain ?? 0.1, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + t.dur + 0.02);
  }
}

/** 단일 진입점 — kind 에 따라 햅틱과 사운드를 한 번에 트리거. */
export function feedback(kind: FeedbackKind) {
  if (isHapticEnabled()) vibrate(HAPTIC_PATTERNS[kind]);
  if (isSoundEnabled())  playTones(SOUND_PATTERNS[kind]);
}
