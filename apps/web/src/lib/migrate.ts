import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

type DocMap = Record<string, any>;

export interface GuestSnapshot {
  habits: DocMap;
  prayers: DocMap;
  people: DocMap;
  days: Record<string, { data: any; subs: Record<string, DocMap> }>;
  progress: any | null;
  settings: any | null;
}

const DAY_SUBS = ['habitChecks', 'prayerChecks', 'todayTodos', 'gratitudes'] as const;

/**
 * 게스트(익명) uid 의 모든 데이터를 메모리로 읽어온다.
 * 반드시 아직 그 게스트로 인증된 상태에서 호출해야 한다(보안규칙: 본인 데이터만 read).
 */
export async function exportGuestData(uid: string): Promise<GuestSnapshot> {
  const [habits, prayers, people] = await Promise.all([
    readCollection(`users/${uid}/habits`),
    readCollection(`users/${uid}/prayers`),
    readCollection(`users/${uid}/people`),
  ]);

  const days: GuestSnapshot['days'] = {};
  const daysSnap = await getDocs(collection(db, 'users', uid, 'days'));
  for (const dayDoc of daysSnap.docs) {
    const subs: Record<string, DocMap> = {};
    for (const sub of DAY_SUBS) {
      subs[sub] = await readCollection(`users/${uid}/days/${dayDoc.id}/${sub}`);
    }
    days[dayDoc.id] = { data: dayDoc.data(), subs };
  }

  const [progressSnap, settingsSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid, 'progress', 'main')),
    getDoc(doc(db, 'users', uid, 'settings', 'main')),
  ]);

  return {
    habits,
    prayers,
    people,
    days,
    progress: progressSnap.exists() ? progressSnap.data() : null,
    settings: settingsSnap.exists() ? settingsSnap.data() : null,
  };
}

/**
 * exportGuestData 로 읽어둔 스냅샷을 대상 계정(toUid)으로 기록한다.
 * progress/settings 는 대상에 이미 있으면 덮어쓰지 않는다.
 */
export async function importGuestData(toUid: string, snap: GuestSnapshot): Promise<void> {
  await writeCollection(`users/${toUid}/habits`, snap.habits);
  await writeCollection(`users/${toUid}/prayers`, snap.prayers);
  await writeCollection(`users/${toUid}/people`, snap.people);

  for (const [date, day] of Object.entries(snap.days)) {
    await setDoc(doc(db, 'users', toUid, 'days', date), day.data, { merge: true });
    for (const sub of DAY_SUBS) {
      await writeCollection(`users/${toUid}/days/${date}/${sub}`, day.subs[sub] ?? {});
    }
  }

  if (snap.progress) {
    const ref = doc(db, 'users', toUid, 'progress', 'main');
    if (!(await getDoc(ref)).exists()) await setDoc(ref, snap.progress, { merge: true });
  }
  if (snap.settings) {
    const ref = doc(db, 'users', toUid, 'settings', 'main');
    if (!(await getDoc(ref)).exists()) await setDoc(ref, snap.settings, { merge: true });
  }
}

async function readCollection(path: string): Promise<DocMap> {
  const snap = await getDocs(collection(db, path));
  const out: DocMap = {};
  snap.docs.forEach((d) => { out[d.id] = d.data(); });
  return out;
}

async function writeCollection(path: string, docs: DocMap): Promise<void> {
  const ids = Object.keys(docs);
  if (ids.length === 0) return;
  let batch = writeBatch(db);
  let n = 0;
  for (const id of ids) {
    batch.set(docFromPath(`${path}/${id}`), docs[id], { merge: true });
    if (++n >= 400) { await batch.commit(); batch = writeBatch(db); n = 0; }
  }
  if (n > 0) await batch.commit();
}

function docFromPath(path: string) {
  const parts = path.split('/');
  return doc(db, parts[0], ...parts.slice(1));
}
