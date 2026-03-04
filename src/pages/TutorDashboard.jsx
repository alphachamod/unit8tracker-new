import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getAllStudents, saveTutorOverrides, upsertStudent,
  deleteStudent as fbDeleteStudent, clearAllData
} from '../lib/firebase'
import { SECTIONS, BADGES, TOTAL_XP, PASS_XP, PASS_MERIT_XP, calcXP, checkBadges } from '../data/gameData'

const CRIT_COLORS = {
  P3: { bg: '#d4edda', border: '#74c38a', text: '#155724' },
  P4: { bg: '#b8dfc6', border: '#4daa6a', text: '#0f4a1e' },
  P5: { bg: '#8fcba8', border: '#2d8f52', text: '#fff' },
  P6: { bg: '#5cad7a', border: '#1a6e3c', text: '#fff' },
  P7: { bg: '#2d8f52', border: '#0f4a1e', text: '#fff' },
  M2: { bg: '#fff3cd', border: '#f0c060', text: '#7a5200' },
  M3: { bg: '#ffe8a0', border: '#d4a017', text: '#6b4400' },
  D2: { bg: '#ffe4b5', border: '#c8860a', text: '#5c3800' },
  D3: { bg: '#ffd580', border: '#b06800', text: '#4a2800' },
}

function gradeLabel(xp) {
  if (xp >= TOTAL_XP) return { g: 'D*', c: 'var(--dist)' }
  if (xp >= PASS_MERIT_XP) return { g: 'M', c: 'var(--merit)' }
  if (xp >= PASS_XP) return { g: 'P', c: 'var(--pass)' }
  return { g: '—', c: 'var(--slate)' }
}

// ─── Student override modal ────────────────────────────────────
function StudentModal({ student, onClose, onSave }) {
  const [overrides, setOverrides] = useState({ ...(student.tutorOverrides || {}) })
  const [note, setNote] = useState(student.tutorNote || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleOverride(sectionId, state) {
    setOverrides(prev => {
      const next = { ...prev }
      if (next[sectionId] === state) delete next[sectionId]
      else next[sectionId] = state
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const finalSections = SECTIONS.filter(sec => {
      const t = overrides[sec.id]
      const s = (student.completedSections || []).includes(sec.id)
      if (t === true) return true
      if (t === false) return false
      return s
    }).map(s => s.id)

    const newBadges = checkBadges(finalSections, 0, student.streak || 1, overrides)
    const allBadges = [...new Set([...(student.badges || []), ...newBadges])]
    const newXP = calcXP(finalSections, allBadges)

    await saveTutorOverrides(student.studentId, {
      completedSections: finalSections,
      xp: newXP,
      badges: allBadges,
      tutorOverrides: overrides,
      tutorNote: note,
    })
    setSaving(false)
    setSaved(true)
    onSave({ ...student, completedSections: finalSections, xp: newXP, badges: allBadges, tutorOverrides: overrides, tutorNote: note })
  }

  const passTotal  = SECTIONS.filter(s => s.band === 'pass').length
  const passDone   = SECTIONS.filter(s => s.band === 'pass' && (student.completedSections || []).includes(s.id)).length

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,15,30,0.6)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 600,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 900,
              color: 'var(--navy)', marginBottom: 4 }}>{student.name}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>
                {student.studentId}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
                {student.xp || 0} XP
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>
                {passDone}/{passTotal} pass
              </span>
            </div>
          </div>
          <button onClick={onClose}
            style={{ fontSize: 18, color: 'var(--slate)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>
            Click a section: <strong style={{ color: 'var(--pass)' }}>✓ Verify</strong> it,{' '}
            <strong style={{ color: 'var(--red)' }}>✗ Reject</strong> it, or leave unchanged (grey = student self-reported).
          </p>

          {['pass', 'merit', 'distinction'].map(band => (
            <div key={band} style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {band}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SECTIONS.filter(s => s.band === band).map(sec => {
                  const studentDone = (student.completedSections || []).includes(sec.id)
                  const override    = overrides[sec.id]
                  const crit        = CRIT_COLORS[sec.criteria]

                  return (
                    <div key={sec.id} style={{
                      display: 'flex', gap: 8, alignItems: 'center',
                      padding: '10px 12px', borderRadius: 8,
                      background: override === true ? 'var(--pass-light)'
                        : override === false ? 'var(--red-light)'
                        : studentDone ? 'var(--light)' : 'var(--white)',
                      border: `1.5px solid ${override === true ? 'var(--pass-mid)'
                        : override === false ? '#FCA5A5'
                        : studentDone ? 'var(--border)' : 'var(--border)'}`,
                    }}>
                      {crit && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                          background: crit.bg, color: crit.text, border: `1px solid ${crit.border}`,
                          borderRadius: 3, padding: '1px 6px', flexShrink: 0 }}>{sec.criteria}</span>
                      )}
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--navy)' }}>{sec.title}</span>

                      {studentDone && !override && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', flexShrink: 0 }}>
                          self ✓
                        </span>
                      )}

                      <button onClick={() => toggleOverride(sec.id, true)}
                        style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                          background: override === true ? 'var(--pass)' : 'var(--pass-light)',
                          color: override === true ? '#fff' : 'var(--pass)',
                          border: `1.5px solid ${override === true ? 'var(--pass)' : 'var(--pass-mid)'}` }}>
                        ✓
                      </button>
                      <button onClick={() => toggleOverride(sec.id, false)}
                        style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                          background: override === false ? 'var(--red)' : 'var(--red-light)',
                          color: override === false ? '#fff' : 'var(--red)',
                          border: `1.5px solid ${override === false ? 'var(--red)' : '#FCA5A5'}` }}>
                        ✗
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)',
              display: 'block', marginBottom: 6 }}>Note to student (shown on their homepage)</label>
            <textarea value={note} onChange={e => { setNote(e.target.value); setSaved(false) }}
              placeholder="e.g. Your Section 5c needs more annotation on each post..."
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)',
                borderRadius: 8, fontSize: 14, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor='var(--navy)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}/>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)',
          background: 'var(--light)', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
          {saved && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--pass)', fontWeight: 700 }}>
              ✓ Saved to Firebase
            </span>
          )}
          <button onClick={onClose}
            style={{ padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: 'var(--slate)', background: 'var(--white)' }}>
            Close
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '9px 22px', background: saving ? '#94a3b8' : 'var(--navy)', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Add / Edit student modal ──────────────────────────────────
function EditStudentModal({ existing, onClose, onSave }) {
  const [name, setName] = useState(existing?.name || '')
  const [studentId, setStudentId] = useState(existing?.studentId || '')
  const [xpOverride, setXpOverride] = useState('')
  const [completedIds, setCompletedIds] = useState(new Set(existing?.completedSections || []))
  const [saving, setSaving] = useState(false)
  const isEdit = !!existing

  function toggleSec(id) {
    setCompletedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim() || !studentId.trim()) return
    setSaving(true)
    const sid = studentId.trim().toUpperCase()
    const completed = [...completedIds]
    const badges = checkBadges(completed, 0, 1, {})
    const xp = xpOverride ? parseInt(xpOverride) : calcXP(completed, badges)
    const data = { name: name.trim(), completedSections: completed, xp, badges, tutorOverrides: existing?.tutorOverrides || {}, tutorNote: existing?.tutorNote || '', streak: existing?.streak || 1 }
    await upsertStudent(sid, data)
    setSaving(false)
    onSave({ studentId: sid, ...data })
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(10,15,30,0.6)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 520,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 900 }}>
            {isEdit ? 'Edit Student' : 'Add New Student'}
          </h3>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--slate)' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Full Name', val: name, set: setName, placeholder: 'e.g. Ayman Abdirashid' },
            { label: 'Student ID', val: studentId, set: v => setStudentId(v.toUpperCase()), placeholder: 'e.g. ABD24224712', disabled: isEdit },
            { label: 'XP Override (optional — leave blank to auto-calculate)', val: xpOverride, set: setXpOverride, placeholder: 'e.g. 500', type: 'number' },
          ].map(({ label, val, set, placeholder, disabled, type }) => (
            <div key={label}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 5 }}>{label}</label>
              <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                disabled={disabled} type={type || 'text'}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
                  borderRadius: 8, fontSize: 14, background: disabled ? 'var(--light)' : 'var(--white)' }}
                onFocus={e => e.target.style.borderColor='var(--navy)'}
                onBlur={e => e.target.style.borderColor='var(--border)'}/>
            </div>
          ))}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>
              Completed Sections
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
              {SECTIONS.map(sec => {
                const done = completedIds.has(sec.id)
                const c = CRIT_COLORS[sec.criteria]
                return (
                  <button key={sec.id} onClick={() => toggleSec(sec.id)}
                    style={{ padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      textAlign: 'left', border: `1.5px solid ${done ? (c?.border || 'var(--pass)') : 'var(--border)'}`,
                      background: done ? (c?.bg || 'var(--pass-light)') : 'var(--light)',
                      color: done ? (c?.text || 'var(--pass)') : 'var(--slate)',
                      fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
                    {sec.criteria} {sec.short.slice(0, 12)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--light)',
          display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 16px', border: '1.5px solid var(--border)', borderRadius: 8,
              fontSize: 13, color: 'var(--slate)', background: 'var(--white)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !studentId.trim()}
            style={{ padding: '9px 22px', background: 'var(--navy)', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 700, opacity: (!name.trim() || !studentId.trim()) ? 0.5 : 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Confirm dialog ────────────────────────────────────────────
function ConfirmDialog({ icon, title, message, onConfirm, onClose, requireWord }) {
  const [typed, setTyped] = useState('')
  const valid = !requireWord || typed === requireWord
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(10,15,30,0.7)',
        backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: 'var(--white)', borderRadius: 16, padding: '36px 32px',
          maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
        <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.6, marginBottom: requireWord ? 16 : 24 }}>{message}</p>
        {requireWord && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>Type <strong>{requireWord}</strong> to confirm:</p>
            <input value={typed} onChange={e => setTyped(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)',
                borderRadius: 8, fontSize: 14, textAlign: 'center', fontFamily: 'var(--font-mono)' }}/>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onClose}
            style={{ padding: '10px 20px', border: '1.5px solid var(--border)', borderRadius: 8,
              fontSize: 14, color: 'var(--navy)' }}>Cancel</button>
          <button onClick={onConfirm} disabled={!valid}
            style={{ padding: '10px 24px', background: valid ? 'var(--red)' : '#94a3b8',
              color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Confirm
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main tutor dashboard ──────────────────────────────────────
export default function TutorDashboard({ onLogout }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)      // student object
  const [editModal, setEditModal] = useState(null) // null=closed, false=new, student=edit
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    getAllStudents().then(all => {
      setStudents(all.sort((a, b) => (b.xp || 0) - (a.xp || 0)))
      setLoading(false)
    })
  }, [])

  function handleOverrideSave(updated) {
    setStudents(prev => prev.map(s => s.studentId === updated.studentId ? updated : s))
  }

  function handleStudentUpsert(saved) {
    setStudents(prev => {
      const idx = prev.findIndex(s => s.studentId === saved.studentId)
      if (idx > -1) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved].sort((a, b) => (b.xp || 0) - (a.xp || 0))
    })
  }

  async function handleDelete(student) {
    setConfirm({
      icon: '🗑️', title: `Delete ${student.name}?`,
      message: 'This permanently removes all their data from Firebase. This cannot be undone.',
      onConfirm: async () => {
        await fbDeleteStudent(student.studentId)
        setStudents(prev => prev.filter(s => s.studentId !== student.studentId))
        setConfirm(null)
      }
    })
  }

  async function handleClearAll() {
    setConfirm({
      icon: '⚠️', title: 'Clear ALL student data?',
      message: 'This resets every student\'s XP, sections, and badges to zero. Cannot be undone.',
      requireWord: 'CLEAR',
      onConfirm: async () => {
        await clearAllData()
        setStudents(prev => prev.map(s => ({ ...s, xp: 0, completedSections: [], badges: [] })))
        setConfirm(null)
      }
    })
  }

  const filtered = students.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(search.toLowerCase())
  )

  const totalStudents = students.length
  const submittedPass = students.filter(s => (s.xp || 0) >= PASS_XP).length
  const submittedMerit = students.filter(s => (s.xp || 0) >= PASS_MERIT_XP).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--light)' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--navy)', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff',
            background: 'rgba(255,255,255,0.15)', padding: '3px 8px', borderRadius: 4 }}>Unit 8</span>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 700, color: '#fff' }}>
            Tutor Dashboard
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginRight: 8 }}>
            Mr Ravindu
          </span>
          <button onClick={onLogout}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)', color: '#fff',
              borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)' }}>
            Log out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Students', val: totalStudents, color: 'var(--navy)' },
            { label: 'On track for Pass+', val: submittedPass, color: 'var(--pass)' },
            { label: 'On track for Merit+', val: submittedMerit, color: 'var(--merit)' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--white)', borderRadius: 12,
              padding: '16px 18px', border: '1.5px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, color: stat.color }}>
                {stat.val}
              </div>
              <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student name or ID..."
            style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: '1.5px solid var(--border)',
              borderRadius: 8, fontSize: 14 }}
            onFocus={e => e.target.style.borderColor='var(--navy)'}
            onBlur={e => e.target.style.borderColor='var(--border)'}/>
          <button onClick={() => setEditModal(false)}
            style={{ padding: '9px 18px', background: 'var(--pass)', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            + Add Student
          </button>
          <button onClick={handleClearAll}
            style={{ padding: '9px 18px', background: 'var(--red-light)', color: 'var(--red)',
              border: '1.5px solid #FCA5A5', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            🗑️ Clear All XP
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--slate)' }}>Loading...</div>
        ) : (
          <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--light)', borderBottom: '1px solid var(--border)' }}>
                  {['Student', 'ID', 'XP', 'Grade', 'Pass', 'Merit', 'Dist', 'Badges', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)',
                      fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase',
                      letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const { g, c } = gradeLabel(s.xp || 0)
                  const completed = s.completedSections || []
                  const passD  = SECTIONS.filter(x => x.band === 'pass' && completed.includes(x.id)).length
                  const meritD = SECTIONS.filter(x => x.band === 'merit' && completed.includes(x.id)).length
                  const distD  = SECTIONS.filter(x => x.band === 'distinction' && completed.includes(x.id)).length
                  const passT  = SECTIONS.filter(x => x.band === 'pass').length
                  const meritT = SECTIONS.filter(x => x.band === 'merit').length
                  const distT  = SECTIONS.filter(x => x.band === 'distinction').length
                  const hasRejections = Object.values(s.tutorOverrides || {}).includes(false)

                  return (
                    <tr key={s.studentId}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer',
                        background: i % 2 === 0 ? 'var(--white)' : 'var(--light)',
                        transition: 'background 0.1s' }}
                      onClick={() => setModal(s)}
                      onMouseEnter={e => e.currentTarget.style.background='#EEF2FF'}
                      onMouseLeave={e => e.currentTarget.style.background=i%2===0?'var(--white)':'var(--light)'}>
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>
                          {s.name || '—'}
                          {hasRejections && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--red)' }}>⚠️</span>}
                        </div>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>{s.studentId}</code>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                          {s.xp || 0}
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                          background: c + '22', color: c, padding: '2px 7px', borderRadius: 4 }}>{g}</span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                          color: passD === passT ? 'var(--pass)' : 'var(--slate)' }}>
                          {passD}/{passT}
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                          color: meritD > 0 ? 'var(--merit)' : 'var(--slate)' }}>
                          {meritD}/{meritT}
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                          color: distD > 0 ? 'var(--dist)' : 'var(--slate)' }}>
                          {distD}/{distT}
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontSize: 12, color: 'var(--slate)' }}>{(s.badges || []).length}</span>
                      </td>
                      <td style={{ padding: '11px 12px' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditModal(s)}
                          style={{ fontSize: 13, padding: '3px 8px', borderRadius: 5,
                            background: '#EEF2FF', color: '#6366F1', marginRight: 4, fontWeight: 700 }}>✏️</button>
                        <button onClick={() => handleDelete(s)}
                          style={{ fontSize: 13, padding: '3px 8px', borderRadius: 5,
                            background: 'var(--red-light)', color: 'var(--red)', fontWeight: 700 }}>🗑️</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate)' }}>No students found.</div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal && <StudentModal student={modal} onClose={() => setModal(null)} onSave={updated => { handleOverrideSave(updated); setModal(null) }} />}
      </AnimatePresence>
      <AnimatePresence>
        {editModal !== null && <EditStudentModal existing={editModal || null} onClose={() => setEditModal(null)} onSave={handleStudentUpsert} />}
      </AnimatePresence>
      <AnimatePresence>
        {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
      </AnimatePresence>
    </div>
  )
}
