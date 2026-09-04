import * as admin from 'firebase-admin';

admin.initializeApp();
// 웹 클라이언트(initializeFirestore ignoreUndefinedProperties)와 동일하게,
// 서버 쓰기에서도 undefined 필드를 무시한다. 이 설정이 없으면 undefined 필드를
// 포함한 set()이 throw 되어 쓰기가 조용히 실패할 수 있다.
admin.firestore().settings({ ignoreUndefinedProperties: true });

export { dailyReset }  from './dailyReset';
export { dayScoreEngine } from './dayScore';
export { generateFeedback } from './feedback';
export { monthlyBackup } from './backup';
export { parsePrayerBulk } from './parsePrayer';
export { suggestPrayerVerse } from './suggestPrayerVerse';
export { findDuplicatePrayers } from './findDuplicates';
export { generatePrayerWeekly } from './prayerWeekly';
export { prayerAward, prayerAnsweredAward } from './prayerAward';
export { applicationAward } from './applicationAward';
export { parseApplication } from './parseApplication';
export { aiCoach } from './aiCoach';
export { sendScheduledReminder } from './reminders';
export { flushReminderQueue } from './reminderQueue';
export { morningBrief } from './morningBrief';
export { progressWeekly } from './progressWeekly';
export { ensureUserProfile, approveUser, listPendingUsers } from './userProfile';
