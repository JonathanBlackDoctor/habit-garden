import { describe, it, expect } from 'vitest';
import {
  plannerDateKST, formatDateLabel, escapeHtml,
  isPrivateTelegramChat,
  encodeCallback, parseCallback, CALLBACK_MAX_BYTES,
  visibleHabits, isAchieved, statusIcon,
  buildHabitListMessage, buildScorePicker, HABIT_LIST_LIMIT,
  newReflectionSession, currentStep, applyReflectionInput, parseScreenTime,
  reflectionPrompt, buildReflectionSteps,
  buildSettingsMessage, isNotifKey, NOTIF_KEYS,
} from './telegram';
import type { HabitDoc, HabitCheckDoc } from '../types/firestore';

const habit = (over: Partial<HabitDoc> = {}): HabitDoc => ({
  id: 'h1', title: '아침 QT', weight: 10, timeOfDay: 'morning', order: 0,
  scoreMode: 'scaled', achieveThreshold: 3, iconName: 'sun', active: true, ...over,
});
const check = (over: Partial<HabitCheckDoc> = {}): HabitCheckDoc => ({
  habitId: 'h1', score: 4, achieved: true, checkedAt: null as any, ...over,
});

describe('텔레그램 대화 보안 경계', () => {
  it('발신자와 chat id가 같은 개인 대화만 허용한다', () => {
    expect(isPrivateTelegramChat({ id: 123, type: 'private' }, 123)).toBe(true);
    expect(isPrivateTelegramChat({ id: '123', type: 'private' }, 123)).toBe(true);
  });

  it('그룹·채널과 발신자 불일치는 거부한다', () => {
    expect(isPrivateTelegramChat({ id: -1001, type: 'group' }, 123)).toBe(false);
    expect(isPrivateTelegramChat({ id: -1001, type: 'supergroup' }, 123)).toBe(false);
    expect(isPrivateTelegramChat({ id: -1001, type: 'channel' }, undefined)).toBe(false);
    expect(isPrivateTelegramChat({ id: 123, type: 'private' }, 456)).toBe(false);
  });
});

describe('plannerDateKST — 04:00 경계', () => {
  it('KST 03:59 는 전날로 잡힌다', () => {
    expect(plannerDateKST(new Date('2026-09-05T18:59:00Z'))).toBe('2026-09-05'); // KST 09/06 03:59
  });
  it('KST 04:00 부터 새 날짜', () => {
    expect(plannerDateKST(new Date('2026-09-05T19:00:00Z'))).toBe('2026-09-06'); // KST 09/06 04:00
  });
  it('KST 낮 시간은 그날 날짜', () => {
    expect(plannerDateKST(new Date('2026-09-05T05:00:00Z'))).toBe('2026-09-05'); // KST 14:00
  });
});

describe('formatDateLabel', () => {
  it('요일까지 한국어로 붙인다', () => {
    expect(formatDateLabel('2026-09-05')).toBe('9월 5일(토)');
  });
});

describe('escapeHtml', () => {
  it('HTML 특수문자를 막는다', () => {
    expect(escapeHtml('<b>&"</b>')).toBe('&lt;b&gt;&amp;"&lt;/b&gt;');
  });
});

describe('콜백 인코딩', () => {
  it('왕복 변환된다', () => {
    const cbs = [
      { ns: 't', action: 'list', date: '2026-09-05' },
      { ns: 't', action: 'pick', date: '2026-09-05', habitId: 'abcDEF123' },
      { ns: 't', action: 'save', date: '2026-09-05', habitId: 'abcDEF123', score: 4 },
      { ns: 't', action: 'save', date: '2026-09-05', habitId: 'abcDEF123', score: null },
      { ns: 't', action: 'clear', date: '2026-09-05', habitId: 'abcDEF123' },
      { ns: 'r', action: 'answer', value: 'sat7' },
      { ns: 'r', action: 'cancel' },
      { ns: 'r', action: 'start' },
      { ns: 'n', action: 'toggle', key: 'reflectionReminder' },
    ] as const;
    for (const cb of cbs) expect(parseCallback(encodeCallback(cb as any))).toEqual(cb);
  });

  it('Firestore 자동 id(20자)를 써도 64바이트를 넘지 않는다', () => {
    const s = encodeCallback({ ns: 't', action: 'save', date: '2026-09-05', habitId: 'a'.repeat(20), score: null });
    expect(Buffer.byteLength(s, 'utf8')).toBeLessThanOrEqual(CALLBACK_MAX_BYTES);
  });

  it('너무 긴 페이로드는 만들다 실패한다', () => {
    expect(() => encodeCallback({ ns: 't', action: 'pick', date: '2026-09-05', habitId: 'x'.repeat(60) })).toThrow();
  });

  it('알 수 없는 값은 예외 대신 null', () => {
    for (const bad of [undefined, null, '', 'zzz', 't', 't:l', 't:s:2026-09-05:h1:abc', 'r:a'])
      expect(parseCallback(bad as any)).toBeNull();
  });
});

describe('습관 목록·달성 판정', () => {
  it('비활성·휴면 습관은 빼고 order 순으로 준다', () => {
    const list = visibleHabits([
      habit({ id: 'c', order: 2 }),
      habit({ id: 'b', order: 1, active: false }),
      habit({ id: 'd', order: 3, hibernatedSince: '2026-09-01' }),
      habit({ id: 'e', order: 4, hibernatedSince: '2026-09-01', hibernatedUntil: '2026-09-03' }),
      habit({ id: 'a', order: 0 }),
    ]);
    expect(list.map((h) => h.id)).toEqual(['a', 'c', 'e']);
  });

  it('scaled 는 습관별 achieveThreshold 가 아니라 공용 상수(3)를 쓴다', () => {
    const h = habit({ scoreMode: 'scaled', achieveThreshold: 5 });
    expect(isAchieved(h, 3)).toBe(true);
    expect(isAchieved(h, 2)).toBe(false);
    expect(isAchieved(h, null)).toBe(false);
  });

  it('binary 는 습관의 achieveThreshold 를 그대로 쓴다', () => {
    const h = habit({ scoreMode: 'binary', achieveThreshold: 1 });
    expect(isAchieved(h, 1)).toBe(true);
    expect(isAchieved(h, 0)).toBe(false);
  });

  it('상태 아이콘', () => {
    expect(statusIcon(undefined)).toBe('⭕');
    expect(statusIcon(check({ score: null, achieved: false }))).toBe('⏭');
    expect(statusIcon(check({ achieved: true }))).toBe('✅');
    expect(statusIcon(check({ score: 2, achieved: false }))).toBe('⚠️');
  });
});

describe('습관 목록 메시지', () => {
  it('진행 상황과 습관별 버튼을 만든다', () => {
    const habits = [habit({ id: 'h1', title: 'QT' }), habit({ id: 'h2', title: '운동', order: 1 })];
    const { text, keyboard } = buildHabitListMessage({
      date: '2026-09-05', habits, checks: { h1: check() }, streak: 12, dayScore: 58,
    });
    expect(text).toContain('체크 1/2');
    expect(text).toContain('🔥 12일째');
    expect(text).toContain('dayScore 58');
    expect(keyboard[0][0].text).toBe('✅ QT');
    expect(keyboard[1][0].text).toBe('⭕ 운동');
    expect(keyboard.at(-1)![0].text).toContain('새로고침');
  });

  it('습관이 많으면 상한까지만 버튼으로 만든다', () => {
    const habits = Array.from({ length: HABIT_LIST_LIMIT + 3 }, (_, i) => habit({ id: `h${i}`, order: i }));
    const { text, keyboard } = buildHabitListMessage({ date: '2026-09-05', habits, checks: {}, streak: 0, dayScore: null });
    expect(keyboard).toHaveLength(HABIT_LIST_LIMIT + 1); // + 새로고침
    expect(text).toContain('앱에서 확인');
  });

  it('습관이 없으면 안내만 남기고 버튼을 만들지 않는다', () => {
    const { text, keyboard } = buildHabitListMessage({ date: '2026-09-05', habits: [], checks: {}, streak: 0, dayScore: null });
    expect(text).toContain('등록된 습관이 없어요');
    expect(keyboard).toEqual([]);
  });

  it('제목의 HTML 은 이스케이프된다', () => {
    const { text } = buildHabitListMessage({
      date: '2026-09-05', habits: [], checks: {}, streak: 0, dayScore: null,
    });
    expect(text).not.toContain('<script');
  });
});

describe('점수 선택 키보드', () => {
  it('scaled 는 1~5', () => {
    const { keyboard } = buildScorePicker(habit(), '2026-09-05', undefined);
    expect(keyboard[0].map((b) => b.text)).toEqual(['1', '2', '3', '4', '5']);
    expect(keyboard[1].map((b) => b.text)).toEqual(['⏭ 건너뛰기']);
  });

  it('binary 는 달성/미달성', () => {
    const { keyboard } = buildScorePicker(habit({ scoreMode: 'binary' }), '2026-09-05', undefined);
    expect(keyboard[0].map((b) => b.text)).toEqual(['✅ 달성', '❌ 미달성']);
  });

  it('이미 기록이 있으면 지우기 버튼이 붙는다', () => {
    const { keyboard, text } = buildScorePicker(habit(), '2026-09-05', check({ score: 4 }));
    expect(keyboard[1].map((b) => b.text)).toContain('🗑 기록 지우기');
    expect(text).toContain('현재 기록: 4점');
  });

  it('습관 제목의 HTML 을 이스케이프한다', () => {
    const { text } = buildScorePicker(habit({ title: '<b>위험</b>' }), '2026-09-05', undefined);
    expect(text).toContain('&lt;b&gt;위험&lt;/b&gt;');
  });
});

describe('parseScreenTime', () => {
  it.each([
    ['2:30', 150], ['2.30', 150], ['0:45', 45],
    ['2시간 30분', 150], ['2시간', 120], ['45분', 45],
    ['2h30m', 150], ['150', 150],
  ])('%s → %i분', (raw, mins) => {
    expect(parseScreenTime(raw)).toBe(mins);
  });

  it('해석할 수 없으면 null', () => {
    for (const bad of ['', '많이', 'abc', '어제 2시간']) expect(parseScreenTime(bad)).toBeNull();
  });
});

describe('회고 플로우', () => {
  it('어제 다짐이 없으면 resolution 단계를 건너뛴다', () => {
    expect(buildReflectionSteps()).not.toContain('resolution');
    expect(buildReflectionSteps('복습 30분')[0]).toBe('resolution');
  });

  it('필수 질문은 건너뛸 수 없고, 빈 답도 막는다', () => {
    const s = newReflectionSession('2026-09-05');
    expect(currentStep(s)).toBe('q_best');
    expect(applyReflectionInput(s, 'skip').error).toBeTruthy();
    expect(applyReflectionInput(s, '   ').error).toBeTruthy();
    expect(applyReflectionInput(s, 'skip').session.stepIndex).toBe(0); // 단계가 밀리지 않는다
  });

  it('선택 질문(q_word)은 건너뛸 수 있다', () => {
    let s = newReflectionSession('2026-09-05');
    s = applyReflectionInput(s, '아침 QT').session;
    s = applyReflectionInput(s, '숏츠 2시간').session;
    s = applyReflectionInput(s, '수업 직후 복습').session;
    expect(currentStep(s)).toBe('q_word');
    const r = applyReflectionInput(s, 'skip');
    expect(r.error).toBeUndefined();
    expect(r.session.answers.q_word).toBeUndefined();
    expect(currentStep(r.session)).toBe('satisfaction');
  });

  it('처음부터 끝까지 진행하면 done 이 되고 답이 모인다', () => {
    let s = newReflectionSession('2026-09-05', '복습 30분');
    expect(currentStep(s)).toBe('resolution');
    s = applyReflectionInput(s, 'yes').session;
    s = applyReflectionInput(s, '아침 QT').session;
    s = applyReflectionInput(s, '숏츠').session;
    s = applyReflectionInput(s, '복습').session;
    s = applyReflectionInput(s, '흐림').session;
    s = applyReflectionInput(s, 'sat7').session;
    const last = applyReflectionInput(s, '2:30');
    expect(last.done).toBe(true);
    expect(last.session).toMatchObject({
      resolutionPracticed: true,
      daySatisfaction: 7,
      screenTimeMinutes: 150,
      answers: { q_best: '아침 QT', q_regret: '숏츠', q_tomorrow: '복습', q_word: '흐림' },
    });
  });

  it('만족도는 1~10 밖이면 되묻는다', () => {
    let s = newReflectionSession('2026-09-05');
    s = applyReflectionInput(s, 'a').session;
    s = applyReflectionInput(s, 'b').session;
    s = applyReflectionInput(s, 'c').session;
    s = applyReflectionInput(s, 'skip').session;
    expect(currentStep(s)).toBe('satisfaction');
    expect(applyReflectionInput(s, 'sat11').error).toBeTruthy();
    expect(applyReflectionInput(s, '0').error).toBeTruthy();
    expect(applyReflectionInput(s, '8').session.daySatisfaction).toBe(8);
  });

  it('resolution 은 버튼 값만 받는다', () => {
    const s = newReflectionSession('2026-09-05', '복습');
    expect(applyReflectionInput(s, '했어요').error).toBeTruthy();
    expect(applyReflectionInput(s, 'no').session.resolutionPracticed).toBe(false);
  });

  it('질문 화면에는 항상 그만두기 버튼이 있다', () => {
    const s = newReflectionSession('2026-09-05', '복습');
    for (let i = 0; i < s.steps.length; i++) {
      const { keyboard } = reflectionPrompt({ ...s, stepIndex: i });
      expect(keyboard.at(-1)![0].text).toContain('그만두기');
    }
  });
});

describe('알림 설정', () => {
  it('알 수 없는 키는 콜백으로 받지 않는다', () => {
    expect(isNotifKey('habitReminder')).toBe(true);
    expect(isNotifKey('prayerWeekly')).toBe(false);
    expect(parseCallback('n:t:prayerWeekly')).toBeNull();
    expect(parseCallback('n:t:habitReminder')).toEqual({ ns: 'n', action: 'toggle', key: 'habitReminder' });
  });

  it('미설정은 켜짐으로 본다 (서버가 === false 로만 끄므로)', () => {
    const { keyboard } = buildSettingsMessage(undefined, 'gil');
    expect(keyboard).toHaveLength(NOTIF_KEYS.length);
    expect(keyboard.every((row) => row[0].text.startsWith('🔔'))).toBe(true);
  });

  it('false 인 항목만 꺼짐으로 보여준다', () => {
    const { keyboard, text } = buildSettingsMessage({ habitReminder: false }, 'gil');
    expect(keyboard[0][0].text.startsWith('🔕')).toBe(true);
    expect(keyboard[1][0].text.startsWith('🔔')).toBe(true);
    expect(text).toContain('@gil');
  });

  it('username 이 없어도 깨지지 않는다', () => {
    expect(buildSettingsMessage({}, null).text).toContain('연결됨');
  });
});
