import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, get, set, update, remove,
  onValue, off
} from 'firebase/database';
import {
  getAuth, signInAnonymously, signInWithPopup,
  GoogleAuthProvider, onAuthStateChanged, signOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app      = initializeApp(firebaseConfig);
const db       = getDatabase(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

const TUTOR_EMAIL = import.meta.env.VITE_TUTOR_EMAIL || 'githubtestucb@gmail.com';

// ── Auth helpers ──────────────────────────────────────────────

// Silently sign in anonymously (for students — read only)
let _authReady = null;
export function ensureAuth() {
  if (_authReady) return _authReady;
  _authReady = new Promise((resolve, reject) => {
    onAuthStateChanged(auth, user => {
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then(cred => resolve(cred.user)).catch(reject);
      }
    });
  });
  return _authReady;
}

// Google sign-in for tutor
export async function signInTutor() {
  const result = await signInWithPopup(auth, provider);
  const email = result.user.email;
  if (email !== TUTOR_EMAIL) {
    await signOut(auth);
    throw new Error('Unauthorised email. Only the course tutor can access this dashboard.');
  }
  return result.user;
}

export async function signOutTutor() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isTutorEmail(email) {
  return email === TUTOR_EMAIL;
}

// ── helpers ───────────────────────────────────────────────────
function studentsRef()         { return ref(db, 'students'); }
function studentRef(studentId) { return ref(db, `students/${studentId}`); }

// ── Student ops ───────────────────────────────────────────────

export async function loginStudent(studentId, name) {
  await ensureAuth();
  const snap = await get(studentRef(studentId));
  const today     = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (snap.exists()) {
    const data = snap.val();
    let streak = data.streak || 1;
    const lastDate = data.lastStreakDate || '';
    if      (lastDate === yesterday) streak += 1;
    else if (lastDate !== today)     streak  = 1;
    await update(studentRef(studentId), { lastSeen: Date.now(), streak, lastStreakDate: today });
    return { ...data, studentId, streak, lastStreakDate: today };
  } else {
    const newStudent = {
      studentId, name,
      completedSections: [],
      xp: 0,
      badges: [],
      streak: 1,
      lastStreakDate: today,
      tutorOverrides: {},
      tutorNote: '',
      createdAt: Date.now(),
      lastSeen:  Date.now(),
    };
    await set(studentRef(studentId), newStudent);
    return newStudent;
  }
}

export async function saveProgress(studentId, { completedSections, xp, badges, completedTimestamps, milestoneBonus }) {
  await ensureAuth();
  const timestamps = completedTimestamps || {};
  const today     = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const completionDays = [...new Set(
    Object.values(timestamps).map(ms => new Date(ms).toISOString().split('T')[0])
  )].sort();

  let streak = 0;
  if (completionDays.length > 0) {
    const lastDay = completionDays[completionDays.length - 1];
    if (lastDay === today || lastDay === yesterday) {
      streak = 1;
      for (let i = completionDays.length - 2; i >= 0; i--) {
        const curr = new Date(completionDays[i + 1]);
        const prev = new Date(completionDays[i]);
        if (Math.round((curr - prev) / 86400000) === 1) streak++;
        else break;
      }
    }
  }

  await update(studentRef(studentId), {
    completedSections,
    xp,
    badges,
    completedTimestamps: timestamps,
    milestoneBonus: milestoneBonus || 0,
    streak: Math.max(streak, 1),
    lastSeen: Date.now(),
  });
}

export async function getStudent(studentId) {
  await ensureAuth();
  const snap = await get(studentRef(studentId));
  return snap.exists() ? { studentId, ...snap.val() } : null;
}

export function listenToStudent(studentId, callback) {
  ensureAuth().then(() => {
    const r = studentRef(studentId);
    onValue(r, snap => {
      if (snap.exists()) callback({ studentId, ...snap.val() });
    });
  });
  return () => off(studentRef(studentId));
}

export async function setPendingCelebration(studentId, grade) {
  await ensureAuth();
  await update(studentRef(studentId), { pendingCelebration: grade });
}

export async function clearPendingCelebration(studentId) {
  await ensureAuth();
  await update(studentRef(studentId), { pendingCelebration: null });
}

// ── Tutor ops ─────────────────────────────────────────────────

export async function getAllStudents() {
  await ensureAuth();
  const snap = await get(studentsRef());
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, data]) => ({ studentId: id, ...data }));
}

export function listenToAllStudents(callback) {
  ensureAuth().then(() => {
    const r = studentsRef();
    onValue(r, snap => {
      if (!snap.exists()) { callback([]); return; }
      callback(Object.entries(snap.val()).map(([id, data]) => ({ studentId: id, ...data })));
    });
  });
  return () => off(studentsRef());
}

export async function saveTutorOverrides(studentId, { completedSections, xp, badges, tutorOverrides, tutorNote, earlyBonuses, verifyTimestamps, milestoneBonus }) {
  await ensureAuth();
  await update(studentRef(studentId), {
    completedSections,
    xp,
    badges,
    tutorOverrides,
    tutorNote,
    earlyBonuses:     earlyBonuses     || {},
    verifyTimestamps: verifyTimestamps  || {},
    milestoneBonus:   milestoneBonus    || 0,
    lastSeen: Date.now(),
  });
}

export async function upsertStudent(studentId, data) {
  await ensureAuth();
  const snap = await get(studentRef(studentId));
  if (snap.exists()) {
    await update(studentRef(studentId), { ...data, lastSeen: Date.now() });
  } else {
    await set(studentRef(studentId), { ...data, createdAt: Date.now(), lastSeen: Date.now() });
  }
}

export async function deleteStudent(studentId) {
  await ensureAuth();
  await remove(studentRef(studentId));
}

export async function clearAllData() {
  await ensureAuth();
  const snap = await get(studentsRef());
  if (!snap.exists()) return;
  const updates = {};
  Object.keys(snap.val()).forEach(id => {
    updates[`students/${id}/completedSections`] = [];
    updates[`students/${id}/xp`]               = 0;
    updates[`students/${id}/badges`]            = [];
    updates[`students/${id}/streak`]            = 0;
    updates[`students/${id}/tutorOverrides`]    = {};
    updates[`students/${id}/tutorNote`]         = '';
  });
  await update(ref(db), updates);
}