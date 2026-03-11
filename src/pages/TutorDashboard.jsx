import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getAllStudents, saveTutorOverrides, upsertStudent,
  deleteStudent as fbDeleteStudent, clearAllData, setPendingCelebration
} from '../lib/firebase'
import { SECTIONS, BADGES, TOTAL_XP, PASS_XP, PASS_MERIT_XP, calcXP, calcMilestoneBonus, calcEarlyBonus, calcVerifiedXP, checkBadges, WEEKS_DATA, STUDENT_GROUPS, STUDENT_ROSTER, DEADLINE, START_DATE } from '../data/gameData'

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
  if (xp >= TOTAL_XP)      return { g: 'D*', c: 'var(--dist)' }
  if (xp >= PASS_MERIT_XP) return { g: 'M',  c: 'var(--merit)' }
  if (xp >= PASS_XP)       return { g: 'P',  c: 'var(--pass)' }
  return                          { g: '—',  c: 'var(--slate)' }
}

function getVerifiedXP(s) {
  return calcVerifiedXP(s.completedSections, s.badges, s.tutorOverrides, s.earlyBonuses)
}

// Work out what sections should ideally be done by now
function getExpectedSections() {
  const now = new Date()
  const expected = []
  for (const week of WEEKS_DATA) {
    const weekEnd = new Date(week.end + 'T23:59:59')
    if (now >= weekEnd) {
      // All sections mentioned in this week's items
      for (const item of week.items) {
        const sectionIds = SECTIONS
          .filter(s => s.criteria === item.criteria)
          .map(s => s.id)
        expected.push(...sectionIds)
      }
    }
  }
  return [...new Set(expected)]
}

function getScheduleStatus(completedSections) {
  const expected = getExpectedSections()
  if (expected.length === 0) return null // Week 1 still in progress

  const completed = completedSections || []
  const completedExpected = expected.filter(id => completed.includes(id)).length
  const ratio = completedExpected / expected.length

  // Also check if they're ahead — completing things not yet expected
  const totalDone = completed.length
  const totalSections = SECTIONS.length
  const weekProgress = WEEKS_DATA.findIndex(w => {
    const now = new Date()
    return now >= new Date(w.start) && now <= new Date(w.end + 'T23:59:59')
  })
  const currentWeekIndex = weekProgress === -1 ? WEEKS_DATA.length - 1 : weekProgress
  const expectedTotal = Math.round((currentWeekIndex / WEEKS_DATA.length) * totalSections)

  if (totalDone > expectedTotal + 2) return { label: 'Ahead', color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' }
  if (ratio >= 0.8)                  return { label: 'On Track', color: 'var(--pass)', bg: 'var(--pass-light)', border: 'var(--pass-mid)' }
  if (ratio >= 0.5)                  return { label: 'Slightly Behind', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' }
  return                                    { label: 'Behind', color: 'var(--red)', bg: 'var(--red-light)', border: '#FCA5A5' }
}

// ─── XP Breakdown Modal ───────────────────────────────────────
function XPBreakdownModal({ student, onClose }) {
  const verified = SECTIONS.filter(s => student.tutorOverrides?.[s.id] === true)
  const selfOnly = (student.completedSections || []).filter(id => student.tutorOverrides?.[id] !== true)
  const earnedBadges = BADGES.filter(b => (student.badges || []).includes(b.id))
  const earlyBonuses = student.earlyBonuses || {}
  const verifyTimestamps = student.verifyTimestamps || {}
  const completedTimestamps = student.completedTimestamps || {}

  const baseXP = verified.reduce((a, s) => a + s.xp, 0)
  const badgeXP = earnedBadges.reduce((a, b) => a + b.xpBonus, 0)
  // Only count early bonuses for verified sections
  const earlyXP = Object.entries(earlyBonuses)
    .filter(([id]) => student.tutorOverrides?.[id] === true)
    .reduce((a, [, v]) => a + v, 0)
  const totalVerifiedXP = calcVerifiedXP(student.completedSections, student.badges, student.tutorOverrides, earlyBonuses)
  const bandColors = {
    pass: { color: 'var(--pass)', bg: 'var(--pass-light)', border: 'var(--pass-mid)' },
    merit: { color: 'var(--merit)', bg: '#fffbeb', border: '#FCD34D' },
    distinction: { color: 'var(--dist)', bg: '#fff7ed', border: '#FDBA74' },
  }

  function formatDate(ts) {
    if (!ts) return null
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function getEarlyLabel(bonus) {
    if (bonus >= 40) return { text: 'Very Early', color: '#7C3AED' }
    if (bonus >= 20) return { text: 'Early', color: '#2563EB' }
    return { text: 'Slightly Early', color: '#0891B2' }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(10,15,30,0.65)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 560,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--navy)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 900, color: '#fff' }}>
              {student.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              XP Breakdown
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 900, color: '#FCD34D' }}>
                {totalVerifiedXP} XP
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                verified total
              </div>
            </div>
            <button onClick={onClose}
              style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 22px', borderBottom: '1px solid var(--border)',
          background: 'var(--light)', flexWrap: 'wrap' }}>
          {[
            { label: 'Section XP', val: baseXP, color: 'var(--navy)' },
            { label: 'Badge XP', val: badgeXP, color: 'var(--gold)' },
            { label: 'Early Bonus', val: earlyXP, color: '#7C3AED' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: 'var(--white)', border: '1.5px solid var(--border)',
              borderRadius: 8, padding: '8px 14px', textAlign: 'center', flex: 1, minWidth: 100 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 900, color }}>{val}</div>
              <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Verified sections by band */}
          {['pass', 'merit', 'distinction'].map(band => {
            const bandSecs = verified.filter(s => s.band === band)
            if (bandSecs.length === 0) return null
            const { color, bg, border } = bandColors[band]
            return (
              <div key={band}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                  color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  {band} sections
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {bandSecs.map(sec => {
                    const bonus = earlyBonuses[sec.id] || 0
                    const ts = verifyTimestamps[sec.id]
                    const earlyLabel = bonus > 0 ? getEarlyLabel(bonus) : null
                    return (
                      <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                        background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '9px 12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{sec.title}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {completedTimestamps[sec.id] && (
                              <span>📝 Submitted {formatDate(completedTimestamps[sec.id])}</span>
                            )}
                            {ts && (
                              <span>✓ Verified {formatDate(ts)}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {earlyLabel && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                              color: earlyLabel.color, background: earlyLabel.color + '18',
                              border: `1px solid ${earlyLabel.color}44`,
                              borderRadius: 4, padding: '1px 6px' }}>
                              ⚡ +{bonus} {earlyLabel.text}
                            </span>
                          )}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color }}>
                            +{sec.xp + bonus}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Badges */}
          {earnedBadges.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Badges
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {earnedBadges.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    background: '#fffbeb', border: '1px solid #FCD34D', borderRadius: 8, padding: '9px 12px' }}>
                    <span style={{ fontSize: 18 }}>{b.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--slate)' }}>{b.desc}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                      +{b.xpBonus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Self-reported (not yet verified) */}
          {selfOnly.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Self-reported (pending verification)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selfOnly.map(id => {
                  const sec = SECTIONS.find(s => s.id === id)
                  if (!sec) return null
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--light)', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '8px 12px', opacity: 0.7 }}>
                      <span style={{ fontSize: 12, color: 'var(--slate)', flex: 1 }}>{sec.title}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>
                        not verified
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Leaderboard tab ───────────────────────────────────────────
// ─── Progress Tab ─────────────────────────────────────────────
function ProgressTab({ students }) {
  const [groupFilter, setGroupFilter] = useState('all')
  const [search, setSearch] = useState('')
  const now = new Date()

  // Figure out current week index (0-based), capped at last week
  const currentWeekIdx = (() => {
    const idx = WEEKS_DATA.findIndex(w =>
      now >= new Date(w.start) && now <= new Date(w.end + 'T23:59:59')
    )
    return idx === -1 ? WEEKS_DATA.length - 1 : idx
  })()

  // For each week, get the section IDs expected by end of that week
  const weekSectionIds = WEEKS_DATA.map(week =>
    SECTIONS.filter(s =>
      week.items.some(item => item.criteria === s.criteria)
    ).map(s => s.id)
  )

  // Days elapsed in current week (0–6)
  const currentWeekStart = new Date(WEEKS_DATA[currentWeekIdx]?.start)
  const currentWeekEnd   = new Date(WEEKS_DATA[currentWeekIdx]?.end + 'T23:59:59')
  const weekDayProgress  = Math.min(1, (now - currentWeekStart) / (currentWeekEnd - currentWeekStart))

  const filtered = students.filter(s => {
    if (groupFilter !== 'all' && STUDENT_GROUPS[s.studentId] !== groupFilter) return false
    if (!search) return true
    return s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(search.toLowerCase())
  }).sort((a, b) => {
    const aD = (a.completedSections || []).length
    const bD = (b.completedSections || []).length
    return bD - aD
  })

  const TOTAL_SECTIONS = SECTIONS.length

  function getStudentWeekStatus(completed, weekIdx) {
    const ids = weekSectionIds[weekIdx] || []
    if (ids.length === 0) return 'none'
    const done = ids.filter(id => completed.includes(id)).length
    const ratio = done / ids.length
    const weekEnd = new Date(WEEKS_DATA[weekIdx].end + 'T23:59:59')
    const isPast = now > weekEnd
    const isCurrent = weekIdx === currentWeekIdx

    if (ratio === 1) return 'complete'
    if (ratio >= 0.5) return isCurrent || isPast ? 'partial' : 'ahead'
    if (ratio > 0)    return isCurrent ? 'started' : isPast ? 'behind' : 'future'
    if (isPast)       return 'missing'
    if (isCurrent)    return 'notstarted'
    return 'future'
  }

  const weekStatusStyles = {
    complete:   { bg: '#22c55e', label: '✓' },
    partial:    { bg: '#f59e0b', label: '~' },
    ahead:      { bg: '#86efac', label: '~' },
    started:    { bg: '#fbbf24', label: '…' },
    behind:     { bg: '#ef4444', label: '!' },
    missing:    { bg: '#fca5a5', label: '✗' },
    notstarted: { bg: '#e2e8f0', label: '' },
    future:     { bg: '#f1f5f9', label: '' },
    none:       { bg: 'transparent', label: '' },
  }

  // Summary stats
  const onTrack  = filtered.filter(s => ['On Track','Ahead'].includes(getScheduleStatus(s.completedSections)?.label)).length
  const behind   = filtered.filter(s => getScheduleStatus(s.completedSections)?.label === 'Behind').length
  const complete = filtered.filter(s => (s.completedSections||[]).length === TOTAL_SECTIONS).length

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'On Track / Ahead', val: onTrack,  color: 'var(--pass)' },
          { label: 'Behind',           val: behind,   color: 'var(--red)' },
          { label: 'All sections done',val: complete, color: 'var(--dist)' },
          { label: 'Showing',          val: filtered.length, color: 'var(--navy)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 900, color: c.color }}>{c.val}</div>
            <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all','A','B','C'].map(g => (
          <button key={g} onClick={() => setGroupFilter(g)}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
              background: groupFilter === g ? 'var(--navy)' : 'var(--white)',
              color: groupFilter === g ? '#fff' : 'var(--slate)',
              border: `1.5px solid ${groupFilter === g ? 'var(--navy)' : 'var(--border)'}` }}>
            {g === 'all' ? `All (${students.length})` : `Grp ${g} (${students.filter(s => STUDENT_GROUPS[s.studentId] === g).length})`}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          style={{ marginLeft: 'auto', padding: '6px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, minWidth: 160 }}/>
      </div>

      {/* Week header */}
      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        {/* Week labels row */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 200px', borderBottom: '2px solid var(--border)', background: 'var(--light)' }}>
          <div style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Student
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS_DATA.length}, 1fr)`, borderLeft: '1px solid var(--border)' }}>
            {WEEKS_DATA.map((w, i) => (
              <div key={i} style={{
                padding: '8px 6px', textAlign: 'center', borderRight: i < WEEKS_DATA.length - 1 ? '1px solid var(--border)' : 'none',
                background: i === currentWeekIdx ? '#EEF2FF' : 'transparent',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: i === currentWeekIdx ? '#4F46E5' : 'var(--slate)' }}>
                  {w.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--slate)', opacity: 0.7, marginTop: 1 }}>{w.dates}</div>
                {i === currentWeekIdx && (
                  <div style={{ marginTop: 4, height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${weekDayProgress * 100}%`, background: '#4F46E5', borderRadius: 2 }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.05em', borderLeft: '1px solid var(--border)' }}>
            Overall Progress
          </div>
        </div>

        {/* Student rows */}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate)' }}>No students found.</div>
        )}
        {filtered.map((s, rowIdx) => {
          const completed = s.completedSections || []
          const verifiedIds = Object.entries(s.tutorOverrides || {}).filter(([,v]) => v === true).map(([k]) => k)
          const totalDone = completed.length
          const totalVerified = verifiedIds.length
          const sectionPct = totalDone / TOTAL_SECTIONS
          const verifiedPct = totalVerified / TOTAL_SECTIONS
          const schedStatus = getScheduleStatus(completed)
          const group = STUDENT_GROUPS[s.studentId]
          const groupColor = group === 'A' ? '#1D4ED8' : group === 'B' ? '#6D28D9' : group === 'C' ? '#065F46' : 'var(--slate)'
          const groupBg    = group === 'A' ? '#DBEAFE' : group === 'B' ? '#F3E8FF' : group === 'C' ? '#D1FAE5' : 'var(--light)'

          return (
            <div key={s.studentId} style={{
              display: 'grid', gridTemplateColumns: '220px 1fr 200px',
              borderBottom: rowIdx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              background: rowIdx % 2 === 0 ? 'var(--white)' : '#fafbfc',
            }}>
              {/* Name cell */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{s.name}</span>
                  {group && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, background: groupBg, color: groupColor, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>{group}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {schedStatus && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                      background: schedStatus.bg, color: schedStatus.color, border: `1px solid ${schedStatus.border}`,
                      padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>{schedStatus.label}</span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)' }}>
                    {totalDone}/{TOTAL_SECTIONS} done · {totalVerified} verified
                  </span>
                </div>
              </div>

              {/* Week cells */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS_DATA.length}, 1fr)`, borderLeft: '1px solid var(--border)' }}>
                {WEEKS_DATA.map((w, wi) => {
                  const ids = weekSectionIds[wi] || []
                  const doneSections = ids.filter(id => completed.includes(id))
                  const verifiedSections = ids.filter(id => verifiedIds.includes(id))
                  const status = getStudentWeekStatus(completed, wi)
                  const { bg } = weekStatusStyles[status]
                  const pct = ids.length > 0 ? doneSections.length / ids.length : 0
                  const vPct = ids.length > 0 ? verifiedSections.length / ids.length : 0

                  return (
                    <div key={wi} title={`${w.label}: ${doneSections.length}/${ids.length} done, ${verifiedSections.length} verified`}
                      style={{
                        padding: '10px 8px', borderRight: wi < WEEKS_DATA.length - 1 ? '1px solid var(--border)' : 'none',
                        background: wi === currentWeekIdx ? '#F5F3FF' : 'transparent',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5,
                      }}>
                      {ids.length > 0 ? (
                        <>
                          {/* Self-reported bar */}
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', inset: 0, width: `${pct * 100}%`, background: bg, borderRadius: 4, transition: 'width 0.3s' }}/>
                          </div>
                          {/* Verified bar */}
                          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${vPct * 100}%`, background: 'var(--pass)', borderRadius: 4, transition: 'width 0.3s' }}/>
                          </div>
                          {/* Count */}
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)', textAlign: 'center' }}>
                            {doneSections.length}/{ids.length}
                            {verifiedSections.length > 0 && <span style={{ color: 'var(--pass)', marginLeft: 3 }}>✓{verifiedSections.length}</span>}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 9, color: 'var(--slate)', textAlign: 'center', opacity: 0.4 }}>—</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Overall progress cell */}
              <div style={{ padding: '12px 16px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                {/* Sections bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--slate)' }}>Sections</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--navy)' }}>{Math.round(sectionPct * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${verifiedPct * 100}%`, background: 'var(--pass)', borderRadius: 4 }}/>
                    <div style={{ position: 'absolute', inset: 0, left: `${verifiedPct * 100}%`, width: `${(sectionPct - verifiedPct) * 100}%`, background: '#93c5fd', borderRadius: '0 4px 4px 0' }}/>
                  </div>
                </div>
                {/* XP bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--slate)' }}>XP</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--gold)' }}>{s.xp || 0}</span>
                  </div>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(1, (s.xp || 0) / TOTAL_XP) * 100}%`, background: 'var(--gold)', borderRadius: 4 }}/>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ padding: '10px 16px', background: 'var(--light)', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700 }}>Legend:</span>
          {[
            { color: '#22c55e', label: 'Complete' },
            { color: '#f59e0b', label: 'Partial / In progress' },
            { color: '#ef4444', label: 'Behind / Missing' },
            { color: '#e2e8f0', label: 'Not started yet' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 8, background: l.color, borderRadius: 2 }}/>
              <span style={{ fontSize: 11, color: 'var(--slate)' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
            <div style={{ width: 12, height: 4, background: 'var(--pass)', borderRadius: 2 }}/>
            <span style={{ fontSize: 11, color: 'var(--slate)' }}>Verified (thin bar)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Insights Tab ─────────────────────────────────────────────
function InsightsTab({ students }) {
  const [groupFilter, setGroupFilter] = useState('all')

  const filtered = groupFilter === 'all' ? students
    : students.filter(s => STUDENT_GROUPS[s.studentId] === groupFilter)

  // ── Section completion heatmap ──
  const sectionStats = SECTIONS.map(sec => {
    const selfDone     = filtered.filter(s => (s.completedSections || []).includes(sec.id)).length
    const verified     = filtered.filter(s => s.tutorOverrides?.[sec.id] === true).length
    const rejected     = filtered.filter(s => s.tutorOverrides?.[sec.id] === false).length
    const total        = filtered.length
    return { ...sec, selfDone, verified, rejected, total, pct: total > 0 ? selfDone / total : 0 }
  })

  // ── Grade distribution ──
  const gradeDist = [
    { label: 'D*', color: 'var(--dist)',   min: TOTAL_XP,      max: Infinity },
    { label: 'M',  color: 'var(--merit)',  min: PASS_MERIT_XP, max: TOTAL_XP },
    { label: 'P',  color: 'var(--pass)',   min: PASS_XP,       max: PASS_MERIT_XP },
    { label: '—',  color: 'var(--slate)',  min: 0,             max: PASS_XP },
  ].map(g => ({
    ...g,
    count: filtered.filter(s => {
      const vxp = calcVerifiedXP(s.completedSections, s.badges, s.tutorOverrides, s.earlyBonuses)
      return vxp >= g.min && vxp < g.max
    }).length
  }))
  const maxGradeCount = Math.max(...gradeDist.map(g => g.count), 1)

  // ── Week-by-week cohort progress ──
  // For each week, count how many students completed all sections due by end of that week
  const weekProgress = WEEKS_DATA.map((week, wi) => {
    const expectedIds = SECTIONS.filter(s =>
      WEEKS_DATA.slice(0, wi + 1).some(w => w.items.some(i => i.criteria === s.criteria))
    ).map(s => s.id)

    if (expectedIds.length === 0) return { week, wi, complete: 0, partial: 0, behind: 0, total: filtered.length }

    let complete = 0, partial = 0, behind = 0
    filtered.forEach(s => {
      const done = (s.completedSections || []).filter(id => expectedIds.includes(id)).length
      const ratio = done / expectedIds.length
      if (ratio >= 1)    complete++
      else if (ratio > 0) partial++
      else                behind++
    })
    return { week, wi, complete, partial, behind, total: filtered.length, expectedIds }
  })

  const bandColors = { pass: 'var(--pass)', merit: 'var(--merit)', distinction: 'var(--dist)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Group filter */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['all','A','B','C'].map(g => (
          <button key={g} onClick={() => setGroupFilter(g)}
            style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: groupFilter === g ? 'var(--navy)' : 'var(--white)',
              color: groupFilter === g ? '#fff' : 'var(--slate)',
              border: `1.5px solid ${groupFilter === g ? 'var(--navy)' : 'var(--border)'}` }}>
            {g === 'all' ? `All (${students.length})` : `Grp ${g} (${students.filter(s => STUDENT_GROUPS[s.studentId] === g).length})`}
          </button>
        ))}
      </div>

      {/* ── Grade Distribution ── */}
      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)',
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>
          📊 Grade Distribution (Verified XP)
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: 140 }}>
          {gradeDist.map(g => (
            <div key={g.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900, color: g.color }}>{g.count}</div>
              <div style={{ width: '100%', maxWidth: 80, borderRadius: '6px 6px 0 0', transition: 'height 0.4s',
                height: `${Math.max(4, (g.count / maxGradeCount) * 100)}px`,
                background: g.color, opacity: g.count === 0 ? 0.2 : 1 }}/>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 900, color: g.color }}>{g.label}</div>
              <div style={{ fontSize: 10, color: 'var(--slate)', textAlign: 'center' }}>
                {filtered.length > 0 ? Math.round(g.count / filtered.length * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, height: 1, background: 'var(--border)' }}/>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--slate)' }}>
          Based on tutor-verified XP only. Self-reported sections not counted.
        </div>
      </div>

      {/* ── Week-by-week Cohort Progress ── */}
      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)',
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>
          📅 Week-by-Week Cohort Progress
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {weekProgress.map(({ week, wi, complete, partial, behind, total, expectedIds }) => {
            if (!expectedIds || expectedIds.length === 0) return null
            const now = new Date()
            const weekEnd = new Date(week.end + 'T23:59:59')
            const isPast = now > weekEnd
            const isCurrent = wi === WEEKS_DATA.findIndex(w => now >= new Date(w.start) && now <= new Date(w.end + 'T23:59:59'))
            const completePct = total > 0 ? (complete / total) * 100 : 0
            const partialPct  = total > 0 ? (partial / total) * 100 : 0
            const behindPct   = total > 0 ? (behind / total) * 100 : 0

            return (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', gap: 12, alignItems: 'center',
                padding: '10px 14px', borderRadius: 8,
                background: isCurrent ? '#EEF2FF' : 'var(--light)',
                border: `1.5px solid ${isCurrent ? '#C7D2FE' : 'var(--border)'}` }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                    color: isCurrent ? '#4F46E5' : 'var(--navy)' }}>{week.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--slate)' }}>{week.dates}</div>
                  {isCurrent && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4F46E5', fontWeight: 700, marginTop: 2 }}>← current</div>}
                </div>
                {/* Stacked progress bar */}
                <div>
                  <div style={{ height: 18, borderRadius: 6, overflow: 'hidden', display: 'flex', background: '#e2e8f0' }}>
                    <div style={{ width: `${completePct}%`, background: '#22c55e', transition: 'width 0.4s' }}/>
                    <div style={{ width: `${partialPct}%`,  background: '#f59e0b', transition: 'width 0.4s' }}/>
                    <div style={{ width: `${behindPct}%`,   background: isPast ? '#ef4444' : '#e2e8f0', transition: 'width 0.4s' }}/>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                    {[
                      { label: `${complete} done`, color: '#22c55e' },
                      { label: `${partial} partial`, color: '#f59e0b' },
                      { label: `${behind} ${isPast ? 'missed' : 'not started'}`, color: isPast ? '#ef4444' : 'var(--slate)' },
                    ].map(l => (
                      <span key={l.label} style={{ fontSize: 10, color: l.color, fontWeight: 600 }}>{l.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 900,
                    color: completePct >= 80 ? '#22c55e' : completePct >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {Math.round(completePct)}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--slate)' }}>completed</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section Completion Heatmap ── */}
      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)',
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>
          🔥 Section Completion Heatmap
        </div>
        {['pass', 'merit', 'distinction'].map(band => (
          <div key={band} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: bandColors[band], textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {band}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sectionStats.filter(s => s.band === band).map(sec => {
                const pct = sec.pct
                // Heat colour: 0% = cold grey, 100% = green
                const r = Math.round(220 - pct * 120)
                const g = Math.round(220 + pct * 35)
                const b = Math.round(220 - pct * 130)
                const heatBg = pct === 0 ? '#f1f5f9' : `rgb(${r},${g},${b})`
                const textColor = pct > 0.6 ? '#fff' : 'var(--navy)'
                return (
                  <div key={sec.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 60px',
                    gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8,
                    background: heatBg, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{sec.title}</span>
                    </div>
                    {/* Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: textColor }}>
                        {sec.selfDone}/{sec.total}
                      </span>
                    </div>
                    <div>
                      <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: pct > 0.6 ? 'rgba(255,255,255,0.6)' : bandColors[band], borderRadius: 3 }}/>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {sec.verified > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                          background: 'rgba(255,255,255,0.5)', color: '#166534', borderRadius: 3, padding: '1px 5px' }}>
                          ✓{sec.verified}
                        </span>
                      )}
                      {sec.rejected > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                          background: 'rgba(255,255,255,0.5)', color: 'var(--red)', borderRadius: 3, padding: '1px 5px' }}>
                          ✗{sec.rejected}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                      color: textColor, textAlign: 'right' }}>
                      {Math.round(pct * 100)}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700 }}>Heat:</span>
          {[0, 25, 50, 75, 100].map(p => {
            const r = Math.round(220 - (p/100) * 120)
            const g2 = Math.round(220 + (p/100) * 35)
            const b2 = Math.round(220 - (p/100) * 130)
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, background: p === 0 ? '#f1f5f9' : `rgb(${r},${g2},${b2})`, border: '1px solid rgba(0,0,0,0.08)' }}/>
                <span style={{ fontSize: 10, color: 'var(--slate)' }}>{p}%</span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

function LeaderboardTab({ students }) {
  const [breakdown, setBreakdown] = useState(null)
  const sorted = [...students].sort((a, b) => getVerifiedXP(b) - getVerifiedXP(a))

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--slate)' }}>
          Ranked by verified XP. Tap a student to see their full XP breakdown.
        </p>
      </div>
      <AnimatePresence>
        {breakdown && <XPBreakdownModal student={breakdown} onClose={() => setBreakdown(null)} />}
      </AnimatePresence>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map((s, i) => {
          const vXP = getVerifiedXP(s)
          const { g, c } = gradeLabel(vXP)
          const completed = s.completedSections || []
          const passD  = SECTIONS.filter(x => x.band === 'pass' && completed.includes(x.id)).length
          const meritD = SECTIONS.filter(x => x.band === 'merit' && completed.includes(x.id)).length
          const distD  = SECTIONS.filter(x => x.band === 'distinction' && completed.includes(x.id)).length
          const passT  = SECTIONS.filter(x => x.band === 'pass').length
          const badgeCount = (s.badges || []).length
          const earnedBadges = BADGES.filter(b => (s.badges || []).includes(b.id))
          const schedStatus = getScheduleStatus(completed)
          const initial = s.name?.[0] || '?'

          return (
            <div key={s.studentId}
              onClick={() => setBreakdown({...s, completedTimestamps: s.completedTimestamps || {}})}
              onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
              style={{
                background: 'var(--white)', borderRadius: 10, cursor: 'pointer', transition: 'box-shadow 0.15s',
                border: `1.5px solid ${i === 0 ? '#FCD34D' : i === 1 ? '#CBD5E1' : i === 2 ? '#D97706' : 'var(--border)'}`,
                overflow: 'hidden',
              }}>
              {/* Main row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                {/* Rank */}
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? '#FCD34D' : i === 1 ? '#CBD5E1' : i === 2 ? '#D97706' : 'var(--light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                  color: i < 3 ? '#1a2035' : 'var(--slate)',
                }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--pass-light)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: 'var(--font-head)', fontSize: 14,
                  fontWeight: 900, color: 'var(--pass)',
                }}>{initial}</div>

                {/* Name + status */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{s.name}</span>
                    {schedStatus && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                        background: schedStatus.bg, color: schedStatus.color,
                        border: `1px solid ${schedStatus.border}`,
                        padding: '1px 7px', borderRadius: 4,
                      }}>{schedStatus.label}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 1 }}>
                    {s.studentId} · Pass {passD}/{passT} · Merit {meritD}/{SECTIONS.filter(x=>x.band==='merit').length} · Dist {distD}/{SECTIONS.filter(x=>x.band==='distinction').length}
                    {(s.streak || 0) > 1 && <span style={{ marginLeft: 6, color: '#F97316', fontWeight: 700 }}>🔥 {s.streak}d</span>}
                  </div>
                </div>

                {/* XP + grade + badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {badgeCount > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>
                      🏅 {badgeCount}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                    {vXP} XP
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    background: c + '22', color: c, padding: '2px 8px', borderRadius: 4,
                  }}>{g}</span>
                </div>
              </div>

              {/* Badge row */}
              {earnedBadges.length > 0 && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 5,
                  padding: '8px 16px 10px', paddingLeft: 74,
                  borderTop: '1px solid var(--border)', background: 'var(--light)',
                }}>
                  {earnedBadges.map(b => (
                    <div key={b.id} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'var(--white)', border: '1px solid var(--border)',
                      borderRadius: 5, padding: '2px 7px',
                    }}>
                      <span style={{ fontSize: 12 }}>{b.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{b.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)', fontWeight: 700 }}>
                        +{b.xpBonus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Student override modal ────────────────────────────────────
function StudentModal({ student, onClose, onSave }) {
  const [overrides, setOverrides] = useState({ ...(student.tutorOverrides || {}) })
  const [note, setNote] = useState(student.tutorNote || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const verifyTimestamps = useRef({ ...(student.verifyTimestamps || {}) })

  function toggleOverride(sectionId, state) {
    setOverrides(prev => {
      const next = { ...prev }
      if (next[sectionId] === state) {
        delete next[sectionId]
        delete verifyTimestamps.current[sectionId]
      } else {
        next[sectionId] = state
        if (state === true) verifyTimestamps.current[sectionId] = Date.now()
        else delete verifyTimestamps.current[sectionId]
      }
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const now = Date.now()
    const finalSections = SECTIONS.filter(sec => {
      const t = overrides[sec.id]
      const s = (student.completedSections || []).includes(sec.id)
      if (t === true) return true
      if (t === false) return false
      return s
    }).map(s => s.id)

    // Calculate early bonuses for newly verified sections
    // Use student's own completion timestamp — not the verify time
    const completedTimestamps = student.completedTimestamps || {}
    const prevEarlyBonuses = student.earlyBonuses || {}
    const newEarlyBonuses = { ...prevEarlyBonuses }
    Object.entries(overrides).forEach(([sectionId, val]) => {
      if (val === true && !(sectionId in prevEarlyBonuses)) {
        // Use when the STUDENT ticked the box, not when tutor verified
        const ts = completedTimestamps[sectionId] || now
        const bonus = calcEarlyBonus(sectionId, ts, overrides)
        if (bonus > 0) newEarlyBonuses[sectionId] = bonus
      } else if (val === false) {
        delete newEarlyBonuses[sectionId]
        delete verifyTimestamps.current[sectionId]
      }
    })

    // Badges earned from ALL completed sections (self-reported) — not verified-only
    // Verified XP is computed separately at display time via calcVerifiedXP
    const newBadges = checkBadges(finalSections, 0, student.streak || 1, {})
    const allBadges = [...new Set([...(student.badges || []), ...newBadges])]
    const newXP = calcXP(finalSections, allBadges, newEarlyBonuses)

    await saveTutorOverrides(student.studentId, {
      completedSections: finalSections, xp: newXP, badges: allBadges,
      tutorOverrides: overrides, tutorNote: note, earlyBonuses: newEarlyBonuses,
      verifyTimestamps: verifyTimestamps.current,
    })

    // Determine grade unlocked by checking which bands are fully verified
    // (XP-based check is unreliable due to early/milestone bonuses inflating verified XP)
    const wasVerified = id => (student.tutorOverrides || {})[id] === true
    const isVerified  = id => (overrides)[id] === true
    const passIds        = SECTIONS.filter(s => s.band === 'pass').map(s => s.id)
    const meritIds       = SECTIONS.filter(s => s.band === 'merit').map(s => s.id)
    const distinctionIds = SECTIONS.filter(s => s.band === 'distinction').map(s => s.id)
    const hadPass  = passIds.every(wasVerified)
    const hadMerit = [...passIds, ...meritIds].every(wasVerified)
    const hadDist  = [...passIds, ...meritIds, ...distinctionIds].every(wasVerified)
    const hasPass  = passIds.every(isVerified)
    const hasMerit = [...passIds, ...meritIds].every(isVerified)
    const hasDist  = [...passIds, ...meritIds, ...distinctionIds].every(isVerified)
    const gradeUnlocked =
      (!hadDist  && hasDist)  ? 'D' :
      (!hadMerit && hasMerit) ? 'M' :
      (!hadPass  && hasPass)  ? 'P' : null
    if (gradeUnlocked) {
      await setPendingCelebration(student.studentId, gradeUnlocked)
    }

    setSaving(false); setSaved(true)
    onSave({ ...student, completedSections: finalSections, xp: newXP, badges: allBadges, tutorOverrides: overrides, tutorNote: note, earlyBonuses: newEarlyBonuses, verifyTimestamps: verifyTimestamps.current })
  }

  const passTotal = SECTIONS.filter(s => s.band === 'pass').length
  const passDone  = SECTIONS.filter(s => s.band === 'pass' && (student.completedSections || []).includes(s.id)).length

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
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 900, color: 'var(--navy)', marginBottom: 4 }}>
              {student.name}
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>{student.studentId}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>{student.xp || 0} XP</span>
              {Object.keys(student.earlyBonuses || {}).length > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#7C3AED', fontWeight: 700 }}>
                  ⚡ +{Object.values(student.earlyBonuses || {}).reduce((a,v) => a+v, 0)} early bonus
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>{passDone}/{passTotal} pass</span>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--slate)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>
            Click a section: <strong style={{ color: 'var(--pass)' }}>✓ Verify</strong> it,{' '}
            <strong style={{ color: 'var(--red)' }}>✗ Reject</strong> it, or leave unchanged.
          </p>
          {['pass', 'merit', 'distinction'].map(band => (
            <div key={band} style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{band}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SECTIONS.filter(s => s.band === band).map(sec => {
                  const studentDone = (student.completedSections || []).includes(sec.id)
                  const override = overrides[sec.id]
                  const crit = CRIT_COLORS[sec.criteria]
                  return (
                    <div key={sec.id} style={{
                      display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 8,
                      background: override === true ? 'var(--pass-light)' : override === false ? 'var(--red-light)' : studentDone ? 'var(--light)' : 'var(--white)',
                      border: `1.5px solid ${override === true ? 'var(--pass-mid)' : override === false ? '#FCA5A5' : 'var(--border)'}`,
                    }}>
                      {crit && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                          background: crit.bg, color: crit.text, border: `1px solid ${crit.border}`,
                          borderRadius: 3, padding: '1px 6px', flexShrink: 0 }}>{sec.criteria}</span>
                      )}
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--navy)' }}>{sec.title}</span>
                      {studentDone && !override && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', flexShrink: 0 }}>self ✓</span>
                      )}
                      {override === true && (() => {
                        // Show stored bonus if already saved, otherwise preview what they'd get
                        const storedBonus = (student.earlyBonuses || {})[sec.id]
                        const ts = (student.completedTimestamps || {})[sec.id]
                        const previewBonus = ts ? calcEarlyBonus(sec.id, ts, overrides) : 0
                        const bonus = storedBonus ?? previewBonus
                        return bonus > 0 ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                            color: '#7C3AED', background: '#EDE9FE', border: '1px solid #C4B5FD',
                            borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                            ⚡+{bonus}
                          </span>
                        ) : null
                      })()}
                      <button onClick={() => toggleOverride(sec.id, true)}
                        style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                          background: override === true ? 'var(--pass)' : 'var(--pass-light)',
                          color: override === true ? '#fff' : 'var(--pass)',
                          border: `1.5px solid ${override === true ? 'var(--pass)' : 'var(--pass-mid)'}` }}>✓</button>
                      <button onClick={() => toggleOverride(sec.id, false)}
                        style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                          background: override === false ? 'var(--red)' : 'var(--red-light)',
                          color: override === false ? '#fff' : 'var(--red)',
                          border: `1.5px solid ${override === false ? 'var(--red)' : '#FCA5A5'}` }}>✗</button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 }}>
              Note to student (shown on their homepage)
            </label>
            <textarea value={note} onChange={e => { setNote(e.target.value); setSaved(false) }}
              placeholder="e.g. Your Section 5c needs more annotation on each post..."
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)',
                borderRadius: 8, fontSize: 14, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor='var(--navy)'}
              onBlur={e => e.target.style.borderColor='var(--border)'}/>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)',
          background: 'var(--light)', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {saved && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--pass)', fontWeight: 700 }}>✓ Saved</span>}
          <button onClick={() => {
            const all = {}
            ;(student.completedSections || []).forEach(id => { all[id] = true })
            setOverrides(all)
            setSaved(false)
          }}
            style={{ padding: '9px 18px', border: '1.5px solid var(--pass-mid)', borderRadius: 8,
              fontSize: 13, fontWeight: 700, color: 'var(--pass)', background: 'var(--pass-light)',
              marginRight: 'auto' }}>
            ✓ Verify All
          </button>
          <button onClick={onClose}
            style={{ padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: 'var(--slate)', background: 'var(--white)' }}>Close</button>
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
    setCompletedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  async function handleSave() {
    if (!name.trim() || !studentId.trim()) return
    setSaving(true)
    const sid = studentId.trim().toUpperCase()
    const completed = [...completedIds]
    const badges = checkBadges(completed, 0, 1, {})
    const xp = xpOverride ? parseInt(xpOverride) : calcXP(completed, badges)
    const data = { name: name.trim(), completedSections: completed, xp, badges,
      tutorOverrides: existing?.tutorOverrides || {}, tutorNote: existing?.tutorNote || '', streak: existing?.streak || 1 }
    await upsertStudent(sid, data)
    setSaving(false); onSave({ studentId: sid, ...data }); onClose()
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 900 }}>
            {isEdit ? 'Edit Student' : 'Add New Student'}
          </h3>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--slate)' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Full Name', val: name, set: setName, placeholder: 'e.g. Ayman Abdirashid' },
            { label: 'Student ID', val: studentId, set: v => setStudentId(v.toUpperCase()), placeholder: 'e.g. ABD24224712', disabled: isEdit },
            { label: 'XP Override (optional)', val: xpOverride, set: setXpOverride, placeholder: 'e.g. 500', type: 'number' },
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
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 8 }}>Completed Sections</label>
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
                    {sec.criteria} {sec.short?.slice(0, 12)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--light)',
          display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 16px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--slate)', background: 'var(--white)' }}>
            Cancel
          </button>
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
            style={{ padding: '10px 20px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--navy)' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={!valid}
            style={{ padding: '10px 24px', background: valid ? 'var(--red)' : '#94a3b8', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
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
  const [groupFilter, setGroupFilter] = useState('all')
  const [tab, setTab] = useState('students') // 'students' | 'leaderboard'
  const [modal, setModal] = useState(null)
  const [breakdown, setBreakdown] = useState(null)
  const [editModal, setEditModal] = useState(null)
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
      message: 'This permanently removes all their data. Cannot be undone.',
      onConfirm: async () => {
        await fbDeleteStudent(student.studentId)
        setStudents(prev => prev.filter(s => s.studentId !== student.studentId))
        setConfirm(null)
      }
    })
  }

  async function handleBackfillBonuses() {
    setConfirm({
      icon: '⚡', title: 'Backfill early bonuses?',
      message: 'Students who were verified before timestamp tracking existed will each get +25 XP per verified section with no timestamp. This runs once.',
      requireWord: 'BACKFILL',
      onConfirm: async () => {
        const updated = []
        for (const s of students) {
          const overrides = s.tutorOverrides || {}
          const timestamps = s.completedTimestamps || {}
          const earlyBonuses = { ...(s.earlyBonuses || {}) }
          let changed = false

          // Find verified sections with no completion timestamp and no existing bonus
          Object.entries(overrides).forEach(([sectionId, val]) => {
            if (val === true && !timestamps[sectionId] && !(sectionId in earlyBonuses)) {
              earlyBonuses[sectionId] = 25
              changed = true
            }
          })

          if (changed) {
            const newXP = calcXP(s.completedSections || [], s.badges || [], earlyBonuses)
            await upsertStudent(s.studentId, { ...s, earlyBonuses, xp: newXP })
            updated.push({ ...s, earlyBonuses, xp: newXP })
          } else {
            updated.push(s)
          }
        }
        setStudents(updated.sort((a, b) => (b.xp || 0) - (a.xp || 0)))
        setConfirm(null)
      }
    })
  }

  async function handleRecalcXP() {
    setConfirm({
      icon: '🔄', title: 'Recalculate all XP?',
      message: 'Recalculates every student\'s XP from their completed sections, badges, and early bonuses. Fixes any stale values.',
      requireWord: 'RECALC',
      onConfirm: async () => {
        const updated = []
        for (const s of students) {
          const overrides = s.tutorOverrides || {}
          const newBadges = checkBadges(s.completedSections || [], 0, s.streak || 1, overrides)
          const milestone = calcMilestoneBonus(s.completedSections || [], s.milestoneBonus || 0)
          const newXP = calcXP(s.completedSections || [], newBadges, s.earlyBonuses || {}, milestone)
          await upsertStudent(s.studentId, { ...s, badges: newBadges, xp: newXP })
          updated.push({ ...s, badges: newBadges, xp: newXP })
        }
        setStudents(updated.sort((a, b) => (b.xp || 0) - (a.xp || 0)))
        setConfirm(null)
      }
    })
  }

  async function handleRecalcBadges() {
    setConfirm({
      icon: '🏅', title: 'Recalculate all badges?',
      message: 'Recalculates badges from completed sections and updates XP accordingly.',
      requireWord: 'RECALC',
      onConfirm: async () => {
        const updated = []
        for (const s of students) {
          const overrides = s.tutorOverrides || {}
          const newBadges = checkBadges(s.completedSections || [], 0, s.streak || 1, overrides)
          const milestone = calcMilestoneBonus(s.completedSections || [], s.milestoneBonus || 0)
          const newXP = calcXP(s.completedSections || [], newBadges, s.earlyBonuses || {}, milestone)
          await upsertStudent(s.studentId, { ...s, badges: newBadges, xp: newXP })
          updated.push({ ...s, badges: newBadges, xp: newXP })
        }
        setStudents(updated.sort((a, b) => (b.xp || 0) - (a.xp || 0)))
        setConfirm(null)
      }
    })
  }

  async function handleClearAll() {
    setConfirm({
      icon: '⚠️', title: 'Clear ALL student data?',
      message: 'Resets every student\'s XP, sections, and badges to zero. Cannot be undone.',
      requireWord: 'CLEAR',
      onConfirm: async () => {
        await clearAllData()
        setStudents(prev => prev.map(s => ({ ...s, xp: 0, completedSections: [], badges: [] })))
        setConfirm(null)
      }
    })
  }

  const filtered = students.filter(s => {
    if (groupFilter !== 'all' && STUDENT_GROUPS[s.studentId] !== groupFilter) return false
    if (!search) return true
    return s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(search.toLowerCase())
  })

  const totalStudents  = students.length
  const achievedPass   = students.filter(s => getVerifiedXP(s) >= PASS_XP).length
  const achievedMerit  = students.filter(s => getVerifiedXP(s) >= PASS_MERIT_XP).length
  const behindCount    = students.filter(s => {
    const st = getScheduleStatus(s.completedSections)
    return st?.label === 'Behind'
  }).length

  // Projection: linear extrapolation of current verified XP pace to deadline
  const now = Date.now()
  const totalMs    = DEADLINE.getTime() - START_DATE.getTime()
  const elapsedMs  = Math.max(1, now - START_DATE.getTime())
  const remainingRatio = Math.max(0, (DEADLINE.getTime() - now) / totalMs)
  function projectXP(s) {
    const vXP = getVerifiedXP(s)
    const dailyRate = vXP / (elapsedMs / 86400000)
    const daysLeft  = (DEADLINE.getTime() - now) / 86400000
    return Math.round(vXP + dailyRate * daysLeft)
  }
  const projectedPass  = students.filter(s => getVerifiedXP(s) < PASS_XP  && projectXP(s) >= PASS_XP).length
  const projectedMerit = students.filter(s => getVerifiedXP(s) < PASS_MERIT_XP && projectXP(s) >= PASS_MERIT_XP).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--light)' }}>
      {/* Nav */}
      <nav style={{ background: 'var(--navy)', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff',
            background: 'rgba(255,255,255,0.15)', padding: '3px 8px', borderRadius: 4 }}>Unit 8</span>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 15, fontWeight: 700, color: '#fff' }}>Tutor Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginRight: 8 }}>Mr Ravindu</span>
          <button onClick={onLogout}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.1)', color: '#fff',
              borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.15)' }}>
            Log out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 28 }}>
          {/* Total students — simple */}
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 18px', border: '1.5px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, color: 'var(--navy)' }}>{totalStudents}</div>
            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>Total Students</div>
          </div>
          {/* Pass */}
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 18px', border: '1.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, color: 'var(--pass)' }}>{achievedPass}</div>
              {projectedPass > 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#86efac' }}>+{projectedPass} proj.</div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>Pass grade+</div>
            <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4, display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--pass)', fontWeight: 600 }}>● {achievedPass} achieved</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>◌ {projectedPass} on pace</span>
            </div>
          </div>
          {/* Merit */}
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 18px', border: '1.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, color: 'var(--merit)' }}>{achievedMerit}</div>
              {projectedMerit > 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#fcd34d' }}>+{projectedMerit} proj.</div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>Merit grade+</div>
            <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 4, display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--merit)', fontWeight: 600 }}>● {achievedMerit} achieved</span>
              <span style={{ color: '#b45309', fontWeight: 600 }}>◌ {projectedMerit} on pace</span>
            </div>
          </div>
          {/* Behind */}
          <div style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 18px', border: '1.5px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, color: 'var(--red)' }}>{behindCount}</div>
            <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>Behind Schedule</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {[
            { id: 'students',     label: '👥 Students' },
            { id: 'progress',     label: '📈 Progress' },
            { id: 'insights',     label: '🔍 Insights' },
            { id: 'leaderboard',  label: '🏆 Leaderboard' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: '8px 8px 0 0',
                background: tab === t.id ? 'var(--white)' : 'transparent',
                color: tab === t.id ? 'var(--navy)' : 'var(--slate)',
                border: tab === t.id ? '1.5px solid var(--border)' : '1.5px solid transparent',
                borderBottom: tab === t.id ? '1.5px solid var(--white)' : '1.5px solid transparent',
                marginBottom: tab === t.id ? -1 : 0,
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard tab */}
        {tab === 'leaderboard' && !loading && <LeaderboardTab students={students} />}
        {tab === 'progress'    && !loading && <ProgressTab students={students} />}
        {tab === 'insights'    && !loading && <InsightsTab students={students} />}

        {/* Students tab */}
        {tab === 'students' && (
          <>
            {/* Group filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {['all', 'A', 'B', 'C'].map(g => {
                const rosterTotal = g === 'all' ? Object.keys(STUDENT_ROSTER).filter(id => id !== 'TEST').length
                  : Object.entries(STUDENT_GROUPS).filter(([,v]) => v === g).length
                const registered = g === 'all' ? students.length
                  : students.filter(s => STUDENT_GROUPS[s.studentId] === g).length
                return (
                  <button key={g} onClick={() => setGroupFilter(g)}
                    style={{
                      padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: groupFilter === g ? 'var(--navy)' : 'var(--white)',
                      color: groupFilter === g ? '#fff' : 'var(--slate)',
                      border: `1.5px solid ${groupFilter === g ? 'var(--navy)' : 'var(--border)'}`,
                      transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}>
                    {g === 'all' ? 'All' : `Group ${g}`}
                    <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.8 }}>
                      {registered}/{rosterTotal}
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search student name or ID..."
                style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14 }}
                onFocus={e => e.target.style.borderColor='var(--navy)'}
                onBlur={e => e.target.style.borderColor='var(--border)'}/>
              <button onClick={() => setEditModal(false)}
                style={{ padding: '9px 18px', background: 'var(--pass)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                + Add Student
              </button>
              <button onClick={handleBackfillBonuses}
                style={{ padding: '9px 18px', background: '#FFF7ED', color: '#C2410C',
                  border: '1.5px solid #FDBA74', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                ⚡ Backfill Bonuses
              </button>
              <button onClick={handleRecalcXP}
                style={{ padding: '9px 18px', background: '#EFF6FF', color: '#2563EB',
                  border: '1.5px solid #BFDBFE', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                🔄 Recalc XP
              </button>
              <button onClick={handleRecalcBadges}
                style={{ padding: '9px 18px', background: '#EDE9FE', color: '#7C3AED',
                  border: '1.5px solid #C4B5FD', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                🏅 Recalc Badges
              </button>
              <button onClick={handleClearAll}
                style={{ padding: '9px 18px', background: 'var(--red-light)', color: 'var(--red)',
                  border: '1.5px solid #FCA5A5', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                🗑️ Clear All XP
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--slate)' }}>Loading...</div>
            ) : (
              <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--light)', borderBottom: '1px solid var(--border)' }}>
                      {['Student', 'ID', 'Group', 'XP', 'Grade', 'Pass', 'Merit', 'Dist', 'Badges', 'Streak', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontFamily: 'var(--font-mono)',
                          fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase',
                          letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const vXP = getVerifiedXP(s)
                const { g, c } = gradeLabel(vXP)
                      const completed = s.completedSections || []
                      const passD  = SECTIONS.filter(x => x.band === 'pass' && completed.includes(x.id)).length
                      const meritD = SECTIONS.filter(x => x.band === 'merit' && completed.includes(x.id)).length
                      const distD  = SECTIONS.filter(x => x.band === 'distinction' && completed.includes(x.id)).length
                      const passT  = SECTIONS.filter(x => x.band === 'pass').length
                      const meritT = SECTIONS.filter(x => x.band === 'merit').length
                      const distT  = SECTIONS.filter(x => x.band === 'distinction').length
                      const hasRejections = Object.values(s.tutorOverrides || {}).includes(false)
                      const schedStatus = getScheduleStatus(completed)

                      return (
                        <tr key={s.studentId}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer',
                            background: i % 2 === 0 ? 'var(--white)' : 'var(--light)', transition: 'background 0.1s' }}
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
                            {(() => {
                              const g = STUDENT_GROUPS[s.studentId]
                              const gc = g === 'A' ? { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' }
                                       : g === 'B' ? { bg: '#F3E8FF', color: '#6D28D9', border: '#DDD6FE' }
                                       : g === 'C' ? { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' }
                                       : null
                              return g ? (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                                  background: gc.bg, color: gc.color, border: `1px solid ${gc.border}`,
                                  padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>Grp {g}</span>
                              ) : <span style={{ color: 'var(--slate)', fontSize: 11 }}>—</span>
                            })()}
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                              {getVerifiedXP(s)}
                              <span style={{ fontWeight: 400, color: 'var(--slate)', fontSize: 11 }}> / {s.xp || 0}</span>
                            </span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                              background: c + '22', color: c, padding: '2px 7px', borderRadius: 4 }}>{g}</span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: passD === passT ? 'var(--pass)' : 'var(--slate)' }}>
                              {passD}/{passT}
                            </span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: meritD > 0 ? 'var(--merit)' : 'var(--slate)' }}>
                              {meritD}/{meritT}
                            </span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: distD > 0 ? 'var(--dist)' : 'var(--slate)' }}>
                              {distD}/{distT}
                            </span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <span style={{ fontSize: 12, color: 'var(--slate)' }}>{(s.badges || []).length}</span>
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            {(s.streak || 0) > 1 && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#F97316' }}>
                                🔥 {s.streak}d
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            {schedStatus && (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                                background: schedStatus.bg, color: schedStatus.color,
                                border: `1px solid ${schedStatus.border}`,
                                padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
                              }}>{schedStatus.label}</span>
                            )}
                          </td>
                          <td style={{ padding: '11px 12px' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setBreakdown({...s, completedTimestamps: s.completedTimestamps || {}})}
                              style={{ fontSize: 13, padding: '3px 8px', borderRadius: 5,
                                background: '#f0fdf4', color: 'var(--pass)', marginRight: 4, fontWeight: 700 }}>📊</button>
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
          </>
        )}
      </div>

      <AnimatePresence>
        {breakdown && <XPBreakdownModal student={breakdown} onClose={() => setBreakdown(null)} />}
      </AnimatePresence>
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