import * as admin from 'firebase-admin';

admin.initializeApp();
// 웹 클라이언트(initializeFirestore ignoreUndefinedProperties)와 동일하게,
// 서버 쓰기에서도 undefined 필드를 무시한다. 이 설정이 없으면 witheredSince: undefined 등을
// 포함한 set()이 throw 되어 자동 성장(growRandomPlant) 등이 조용히 실패한다.
admin.firestore().settings({ ignoreUndefinedProperties: true });

export { dailyReset }  from './dailyReset';
export { awardEngine, reflectionAward } from './awardEngine';
export { generateFeedback } from './feedback';
export { monthlyBackup } from './backup';
export { parsePrayerBulk } from './parsePrayer';
export { suggestPrayerVerse } from './suggestPrayerVerse';
export { findDuplicatePrayers } from './findDuplicates';
export { generatePrayerWeekly } from './prayerWeekly';
export { prayerAward, prayerAnsweredAward } from './prayerAward';
export { todoAward } from './todoAward';
export { applicationAward, applicationCompleteAward } from './applicationAward';
export { parseApplication } from './parseApplication';
export { aiCoach } from './aiCoach';
export { sendScheduledReminder } from './reminders';
export { flushReminderQueue } from './reminderQueue';
export { morningBrief } from './morningBrief';
export { ensureUserProfile, approveUser, listPendingUsers } from './userProfile';
