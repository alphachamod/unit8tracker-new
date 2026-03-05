import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, get, set, update, remove,
  serverTimestamp, onValue, off
} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCISD6kFCWYjbal2rL32u6pQlrDyLSwX3I",
  authDomain: "unit8guide.firebaseapp.com",
  databaseURL: "https://unit8guide-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "unit8guide",
  storageBucket: "unit8guide.firebasestorage.app",
  messagingSenderId: "218719342294",
  appId: "1:218719342294:web:d56053b4af0220e5114377",
  measurementId: "G-QL8PWSS8LB"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const TUTOR_PIN = '18539'; // ← change this

// ── helpers ───────────────────────────────────────────────────
function studentsRef()          { return ref(db, 'students'); }
function studentRef(studentId)  { return ref(db, `students/${studentId}`); }

// ── Student ops ───────────────────────────────────────────────

export async function loginStudent(studentId, name) {
  const snap = await get(studentRef(studentId));
  const today = new Date().toISOString().split('T')[0];

  if (snap.exists()) {
    const data = snap.val();
    const lastDate  = data.lastStreakDate || '';
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let streak = data.streak || 1;
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

export async function saveProgress(studentId, { completedSections, xp, badges, completedTimestamps }) {
  // Recalculate streak based on consecutive days with section completions
  const timestamps = completedTimestamps || {};
  const today = new Date().toISOString().split('T')[0];

  // Get unique days where sections were completed
  const completionDays = [...new Set(
    Object.values(timestamps).map(ms => new Date(ms).toISOString().split('T')[0])
  )].sort();

  // Count consecutive days ending today or yesterday
  let streak = 0;
  if (completionDays.length > 0) {
    const lastDay = completionDays[completionDays.length - 1];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    // Only count streak if they completed something today or yesterday (still active)
    if (lastDay === today || lastDay === yesterday) {
      streak = 1;
      for (let i = completionDays.length - 2; i >= 0; i--) {
        const curr = new Date(completionDays[i + 1]);
        const prev = new Date(completionDays[i]);
        const diffDays = Math.round((curr - prev) / 86400000);
        if (diffDays === 1) streak++;
        else break;
      }
    }
  }

  await update(studentRef(studentId), {
    completedSections,
    xp,
    badges,
    completedTimestamps: timestamps,
    streak: Math.max(streak, 1),
    lastSeen: Date.now(),
  });
}

export async function getStudent(studentId) {
  const snap = await get(studentRef(studentId));
  return snap.exists() ? { studentId, ...snap.val() } : null;
}

// ── Tutor ops ─────────────────────────────────────────────────

export function checkTutorPin(pin) {
  return pin === TUTOR_PIN;
}

export async function getAllStudents() {
  const snap = await get(studentsRef());
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, data]) => ({ studentId: id, ...data }));
}

export async function saveTutorOverrides(studentId, { completedSections, xp, badges, tutorOverrides, tutorNote, earlyBonuses, verifyTimestamps }) {
  await update(studentRef(studentId), {
    completedSections,
    xp,
    badges,
    tutorOverrides,
    tutorNote,
    earlyBonuses: earlyBonuses || {},
    verifyTimestamps: verifyTimestamps || {},
    lastSeen: Date.now(),
  });
}

export async function upsertStudent(studentId, data) {
  const snap = await get(studentRef(studentId));
  if (snap.exists()) {
    await update(studentRef(studentId), { ...data, lastSeen: Date.now() });
  } else {
    await set(studentRef(studentId), { ...data, createdAt: Date.now(), lastSeen: Date.now() });
  }
}

export async function deleteStudent(studentId) {
  await remove(studentRef(studentId));
}

export async function clearAllData() {
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