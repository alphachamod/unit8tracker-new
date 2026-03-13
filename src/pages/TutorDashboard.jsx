import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getAllStudents, saveTutorOverrides, upsertStudent,
  deleteStudent as fbDeleteStudent, clearAllData, setPendingCelebration
} from '../lib/firebase'
import { SECTIONS, BADGES, TOTAL_XP, PASS_XP, PASS_MERIT_XP, calcXP, calcMilestoneBonus, calcEarlyBonus, calcVerifiedXP, checkBadges, WEEKS_DATA, STUDENT_GROUPS, STUDENT_ROSTER } from '../data/gameData'

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

// Grade requires sections to be done, not just XP (early bonuses can inflate XP)
function gradeLabel(xp, student) {
  // If student object provided, gate on verified section counts
  if (student) {
    const overrides = student.tutorOverrides || {}
    const completed = student.completedSections || []
    // A section counts toward grade only if student has done it AND not rejected
    const verifiedOrDone = id => completed.includes(id) && overrides[id] !== false
    const passCount = SECTIONS.filter(s => s.band === 'pass').filter(s => verifiedOrDone(s.id)).length
    const meritCount = SECTIONS.filter(s => s.band === 'merit').filter(s => verifiedOrDone(s.id)).length
    const distCount  = SECTIONS.filter(s => s.band === 'distinction').filter(s => verifiedOrDone(s.id)).length
    const totalPass  = SECTIONS.filter(s => s.band === 'pass').length
    const totalMerit = SECTIONS.filter(s => s.band === 'merit').length
    const totalDist  = SECTIONS.filter(s => s.band === 'distinction').length
    if (passCount === totalPass && meritCount === totalMerit && distCount === totalDist) return { g: 'D*', c: 'var(--dist)' }
    if (passCount === totalPass && meritCount === totalMerit) return { g: 'M',  c: 'var(--merit)' }
    if (passCount === totalPass)                              return { g: 'P',  c: 'var(--pass)' }
    return { g: '—', c: 'var(--slate)' }
  }
  // Fallback: XP only (no section data)
  if (xp >= TOTAL_XP)      return { g: 'D*', c: 'var(--dist)' }
  if (xp >= PASS_MERIT_XP) return { g: 'M',  c: 'var(--merit)' }
  if (xp >= PASS_XP)       return { g: 'P',  c: 'var(--pass)' }
  return                          { g: '—',  c: 'var(--slate)' }
}

// ─── Grade Prediction ─────────────────────────────────────────
// Uses weighted velocity: 70% last-7-day rate, 30% overall rate.
// Detects stalls, caps on sections remaining, returns confidence level.
function predictGrade(s) {
  const now        = new Date()
  const deadline   = new Date('2026-04-15T17:00:00')
  const start      = new Date('2026-03-05T00:00:00')
  const remainingMs = deadline - now

  if (remainingMs <= 0) return { ...gradeLabel(0, s), confidence: 'actual', stalledDays: 0 }

  const completed  = s.completedSections || []
  const overrides  = s.tutorOverrides || {}
  const timestamps = s.completedTimestamps || {}   // { sectionId: epochMs }
  const notRejected = id => overrides[id] !== false

  const passSections  = SECTIONS.filter(x => x.band === 'pass')
  const meritSections = SECTIONS.filter(x => x.band === 'merit')
  const distSections  = SECTIONS.filter(x => x.band === 'distinction')

  const passDone  = passSections.filter(x  => completed.includes(x.id)  && notRejected(x.id)).length
  const meritDone = meritSections.filter(x => completed.includes(x.id)  && notRejected(x.id)).length
  const distDone  = distSections.filter(x  => completed.includes(x.id)  && notRejected(x.id)).length
  const totalDone = completed.filter(notRejected).length

  const elapsedDays   = (now - start) / 86400000
  const remainingDays = remainingMs / 86400000

  // ── Timestamps of all valid completions ──────────────────────
  const validTimes = completed
    .filter(notRejected)
    .map(id => timestamps[id])
    .filter(Boolean)
    .map(t => Number(t))
    .sort((a, b) => a - b)

  // ── Stall detection: days since last completion ───────────────
  const lastActivity = validTimes.length > 0 ? Math.max(...validTimes) : null
  const stalledDays  = lastActivity ? Math.floor((now - lastActivity) / 86400000) : Math.floor(elapsedDays)

  // ── 7-day rolling velocity ────────────────────────────────────
  const sevenDaysAgo = now - 7 * 86400000
  const recentCount  = validTimes.filter(t => t >= sevenDaysAgo).length
  const recentVelocity = recentCount / 7   // sections/day in last 7 days

  // ── Overall velocity ──────────────────────────────────────────
  const overallVelocity = elapsedDays > 1 ? totalDone / elapsedDays : 0

  // ── Weighted blend: 70% recent, 30% overall ───────────────────
  // If no timestamps available, fall back to overall only
  const hasTimestamps = validTimes.length > 0
  const blendedVelocity = hasTimestamps
    ? recentVelocity * 0.7 + overallVelocity * 0.3
    : overallVelocity

  // ── Stall penalty: if stalled >5 days, decay velocity ────────
  const stalePenalty = stalledDays > 5
    ? Math.max(0.1, 1 - (stalledDays - 5) * 0.08)  // -8% per day after 5
    : 1
  const effectiveVelocity = blendedVelocity * stalePenalty

  // ── Project extra sections by deadline ───────────────────────
  const extra        = Math.max(0, effectiveVelocity * remainingDays)
  const passRemain   = passSections.length  - passDone
  const meritRemain  = meritSections.length - meritDone
  const distRemain   = distSections.length  - distDone

  const projPassExtra  = Math.min(passRemain,  extra)
  const projMeritExtra = Math.min(meritRemain, Math.max(0, extra - passRemain))
  const projDistExtra  = Math.min(distRemain,  Math.max(0, extra - passRemain - meritRemain))

  const projPass  = passDone  + projPassExtra
  const projMerit = meritDone + projMeritExtra
  const projDist  = distDone  + projDistExtra

  // ── Confidence based on data quality + stall ─────────────────
  let confidence
  if (stalledDays >= 10)                                     confidence = 'low'
  else if (stalledDays >= 5 || !hasTimestamps)               confidence = 'medium'
  else if (recentCount >= 3 && elapsedDays >= 5)             confidence = 'high'
  else                                                       confidence = 'medium'

  const base = { predicted: true, confidence, stalledDays }

  if (projPass >= passSections.length && projMerit >= meritSections.length && projDist >= distSections.length)
    return { g: 'D*', c: 'var(--dist)',  ...base }
  if (projPass >= passSections.length && projMerit >= meritSections.length)
    return { g: 'M',  c: 'var(--merit)', ...base }
  if (projPass >= passSections.length)
    return { g: 'P',  c: 'var(--pass)',  ...base }
  return { g: '—', c: 'var(--slate)', ...base }
}


function getVerifiedXP(s) {
  return calcVerifiedXP(s.completedSections, s.badges, s.tutorOverrides, s.earlyBonuses, s.milestoneBonus || 0)
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
  const earlyXP = Object.entries(earlyBonuses)
    .filter(([id]) => student.tutorOverrides?.[id] === true)
    .reduce((a, [, v]) => a + (v || 0), 0)

  // Mirror calcVerifiedXP: milestone only if verified sections satisfy the condition
  const verifiedIds = verified.map(s => s.id)
  const week1Ids = ['s1','s2a','s2b','s2c','s2d','s2e','s2f','s2g']
  const passIds  = SECTIONS.filter(x => x.band === 'pass').map(x => x.id)
  const meritIds = SECTIONS.filter(x => x.band !== 'distinction').map(x => x.id)
  let milestoneXP = 0
  if (week1Ids.every(id => verifiedIds.includes(id)))   milestoneXP = Math.max(milestoneXP, 120)
  if (passIds.every(id => verifiedIds.includes(id)))    milestoneXP = Math.max(milestoneXP, 200)
  if (meritIds.every(id => verifiedIds.includes(id)))   milestoneXP = Math.max(milestoneXP, 300)
  if (SECTIONS.every(x => verifiedIds.includes(x.id))) milestoneXP = Math.max(milestoneXP, 500)
  milestoneXP = Math.min(milestoneXP, student.milestoneBonus || milestoneXP)

  const totalVerifiedXP = baseXP + badgeXP + earlyXP + milestoneXP

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
            { label: 'Section XP',   val: baseXP,      color: 'var(--navy)' },
            { label: 'Badge XP',     val: badgeXP,     color: 'var(--gold)' },
            { label: 'Early Bonus',  val: earlyXP,     color: '#7C3AED' },
            { label: 'Milestone',    val: milestoneXP, color: '#0891B2' },
          ].filter(x => x.val > 0).map(({ label, val, color }) => (
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

// ─── Progress Tab ─────────────────────────────────────────────
function ProgressTab({ students }) {
  const [groupFilter, setGroupFilter] = useState('all')
  const [search, setSearch] = useState('')
  const now = new Date()

  const currentWeekIdx = (() => {
    const idx = WEEKS_DATA.findIndex(w =>
      now >= new Date(w.start) && now <= new Date(w.end + 'T23:59:59')
    )
    return idx === -1 ? WEEKS_DATA.length - 1 : idx
  })()

  const weekSectionIds = WEEKS_DATA.map(week =>
    SECTIONS.filter(s => week.items.some(item => item.criteria === s.criteria)).map(s => s.id)
  )

  const currentWeekStart = new Date(WEEKS_DATA[currentWeekIdx]?.start)
  const currentWeekEnd   = new Date(WEEKS_DATA[currentWeekIdx]?.end + 'T23:59:59')
  const weekDayProgress  = Math.min(1, (now - currentWeekStart) / (currentWeekEnd - currentWeekStart))

  const filtered = students.filter(s => {
    if (groupFilter !== 'all' && STUDENT_GROUPS[s.studentId] !== groupFilter) return false
    if (!search) return true
    return s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(search.toLowerCase())
  }).sort((a, b) => (b.completedSections || []).length - (a.completedSections || []).length)

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
    complete:   { bg: '#22c55e' },
    partial:    { bg: '#f59e0b' },
    ahead:      { bg: '#86efac' },
    started:    { bg: '#fbbf24' },
    behind:     { bg: '#ef4444' },
    missing:    { bg: '#fca5a5' },
    notstarted: { bg: '#e2e8f0' },
    future:     { bg: '#f1f5f9' },
    none:       { bg: 'transparent' },
  }

  const onTrack  = filtered.filter(s => ['On Track','Ahead'].includes(getScheduleStatus(s.completedSections)?.label)).length
  const behind   = filtered.filter(s => getScheduleStatus(s.completedSections)?.label === 'Behind').length
  const complete = filtered.filter(s => (s.completedSections||[]).length === TOTAL_SECTIONS).length

  return (
    <div>
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

      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 200px', borderBottom: '2px solid var(--border)', background: 'var(--light)' }}>
          <div style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS_DATA.length}, 1fr)`, borderLeft: '1px solid var(--border)' }}>
            {WEEKS_DATA.map((w, i) => (
              <div key={i} style={{ padding: '8px 6px', textAlign: 'center', borderRight: i < WEEKS_DATA.length - 1 ? '1px solid var(--border)' : 'none', background: i === currentWeekIdx ? '#EEF2FF' : 'transparent' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: i === currentWeekIdx ? '#4F46E5' : 'var(--slate)' }}>{w.label}</div>
                <div style={{ fontSize: 10, color: 'var(--slate)', opacity: 0.7, marginTop: 1 }}>{w.dates}</div>
                {i === currentWeekIdx && (
                  <div style={{ marginTop: 4, height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${weekDayProgress * 100}%`, background: '#4F46E5', borderRadius: 2 }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.05em', borderLeft: '1px solid var(--border)' }}>Overall Progress</div>
        </div>

        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate)' }}>No students found.</div>}
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
            <div key={s.studentId} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 200px', borderBottom: rowIdx < filtered.length - 1 ? '1px solid var(--border)' : 'none', background: rowIdx % 2 === 0 ? 'var(--white)' : '#fafbfc' }}>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{s.name}</span>
                  {group && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, background: groupBg, color: groupColor, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>{group}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {schedStatus && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, background: schedStatus.bg, color: schedStatus.color, border: `1px solid ${schedStatus.border}`, padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>{schedStatus.label}</span>}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)' }}>{totalDone}/{TOTAL_SECTIONS} done · {totalVerified} verified</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS_DATA.length}, 1fr)`, borderLeft: '1px solid var(--border)' }}>
                {WEEKS_DATA.map((w, wi) => {
                  const ids = weekSectionIds[wi] || []
                  const doneSections = ids.filter(id => completed.includes(id))
                  const verifiedSections = ids.filter(id => verifiedIds.includes(id))
                  const status = getStudentWeekStatus(completed, wi)
                  const { bg } = weekStatusStyles[status]
                  const pct  = ids.length > 0 ? doneSections.length / ids.length : 0
                  const vPct = ids.length > 0 ? verifiedSections.length / ids.length : 0
                  return (
                    <div key={wi} title={`${w.label}: ${doneSections.length}/${ids.length} done, ${verifiedSections.length} verified`}
                      style={{ padding: '10px 8px', borderRight: wi < WEEKS_DATA.length - 1 ? '1px solid var(--border)' : 'none', background: wi === currentWeekIdx ? '#F5F3FF' : 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                      {ids.length > 0 ? (
                        <>
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', inset: 0, width: `${pct * 100}%`, background: bg, borderRadius: 4, transition: 'width 0.3s' }}/>
                          </div>
                          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${vPct * 100}%`, background: 'var(--pass)', borderRadius: 4, transition: 'width 0.3s' }}/>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--slate)', textAlign: 'center' }}>
                            {doneSections.length}/{ids.length}
                            {verifiedSections.length > 0 && <span style={{ color: 'var(--pass)', marginLeft: 3 }}>✓{verifiedSections.length}</span>}
                          </div>
                        </>
                      ) : <div style={{ fontSize: 9, color: 'var(--slate)', textAlign: 'center', opacity: 0.4 }}>—</div>}
                    </div>
                  )
                })}
              </div>

              <div style={{ padding: '12px 16px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
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

        <div style={{ padding: '10px 16px', background: 'var(--light)', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--slate)', fontWeight: 700 }}>Legend:</span>
          {[{ color: '#22c55e', label: 'Complete' }, { color: '#f59e0b', label: 'Partial' }, { color: '#ef4444', label: 'Behind / Missing' }, { color: '#e2e8f0', label: 'Not started' }].map(l => (
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

// ─── Insights Tab ──────────────────────────────────────────────
function InsightsTab({ students }) {
  const [groupFilter, setGroupFilter] = useState('all')

  const filtered = groupFilter === 'all' ? students
    : students.filter(s => STUDENT_GROUPS[s.studentId] === groupFilter)

  const sectionStats = SECTIONS.map(sec => {
    const selfDone = filtered.filter(s => (s.completedSections || []).includes(sec.id)).length
    const verified = filtered.filter(s => s.tutorOverrides?.[sec.id] === true).length
    const rejected = filtered.filter(s => s.tutorOverrides?.[sec.id] === false).length
    const total    = filtered.length
    return { ...sec, selfDone, verified, rejected, total, pct: total > 0 ? selfDone / total : 0 }
  })

  const gradeDist = [
    { label: 'D*', color: 'var(--dist)',  count: filtered.filter(s => gradeLabel(0, s).g === 'D*').length },
    { label: 'M',  color: 'var(--merit)', count: filtered.filter(s => gradeLabel(0, s).g === 'M').length },
    { label: 'P',  color: 'var(--pass)',  count: filtered.filter(s => gradeLabel(0, s).g === 'P').length },
    { label: '—',  color: 'var(--slate)', count: filtered.filter(s => gradeLabel(0, s).g === '—').length },
  ]
  const maxGradeCount = Math.max(...gradeDist.map(g => g.count), 1)

  const weekProgress = WEEKS_DATA.map((week, wi) => {
    const expectedIds = SECTIONS.filter(s =>
      WEEKS_DATA.slice(0, wi + 1).some(w => w.items.some(i => i.criteria === s.criteria))
    ).map(s => s.id)
    if (expectedIds.length === 0) return { week, wi, complete: 0, partial: 0, behind: 0, total: filtered.length }
    let complete = 0, partial = 0, behind = 0
    filtered.forEach(s => {
      const done = (s.completedSections || []).filter(id => expectedIds.includes(id)).length
      const ratio = done / expectedIds.length
      if (ratio >= 1) complete++
      else if (ratio > 0) partial++
      else behind++
    })
    return { week, wi, complete, partial, behind, total: filtered.length, expectedIds }
  })

  const bandColors = { pass: 'var(--pass)', merit: 'var(--merit)', distinction: 'var(--dist)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
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

      {/* Grade Distribution */}
      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>📊 Grade Distribution (Verified XP)</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: 140 }}>
          {gradeDist.map(g => (
            <div key={g.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900, color: g.color }}>{g.count}</div>
              <div style={{ width: '100%', maxWidth: 80, borderRadius: '6px 6px 0 0', transition: 'height 0.4s', height: `${Math.max(4, (g.count / maxGradeCount) * 100)}px`, background: g.color, opacity: g.count === 0 ? 0.2 : 1 }}/>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 900, color: g.color }}>{g.label}</div>
              <div style={{ fontSize: 10, color: 'var(--slate)', textAlign: 'center' }}>{filtered.length > 0 ? Math.round(g.count / filtered.length * 100) : 0}%</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--slate)' }}>Based on tutor-verified XP only.</div>
      </div>

      {/* Week-by-Week Cohort Progress */}
      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>📅 Week-by-Week Cohort Progress</div>
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
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', gap: 12, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: isCurrent ? '#EEF2FF' : 'var(--light)', border: `1.5px solid ${isCurrent ? '#C7D2FE' : 'var(--border)'}` }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: isCurrent ? '#4F46E5' : 'var(--navy)' }}>{week.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--slate)' }}>{week.dates}</div>
                  {isCurrent && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4F46E5', fontWeight: 700, marginTop: 2 }}>← current</div>}
                </div>
                <div>
                  <div style={{ height: 18, borderRadius: 6, overflow: 'hidden', display: 'flex', background: '#e2e8f0' }}>
                    <div style={{ width: `${completePct}%`, background: '#22c55e', transition: 'width 0.4s' }}/>
                    <div style={{ width: `${partialPct}%`,  background: '#f59e0b', transition: 'width 0.4s' }}/>
                    <div style={{ width: `${behindPct}%`,   background: isPast ? '#ef4444' : '#e2e8f0', transition: 'width 0.4s' }}/>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                    {[{ label: `${complete} done`, color: '#22c55e' }, { label: `${partial} partial`, color: '#f59e0b' }, { label: `${behind} ${isPast ? 'missed' : 'not started'}`, color: isPast ? '#ef4444' : 'var(--slate)' }].map(l => (
                      <span key={l.label} style={{ fontSize: 10, color: l.color, fontWeight: 600 }}>{l.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 900, color: completePct >= 80 ? '#22c55e' : completePct >= 50 ? '#f59e0b' : '#ef4444' }}>{Math.round(completePct)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--slate)' }}>completed</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section Completion Heatmap */}
      <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 18 }}>🔥 Section Completion Heatmap</div>
        {['pass', 'merit', 'distinction'].map(band => (
          <div key={band} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: bandColors[band], textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{band}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sectionStats.filter(s => s.band === band).map(sec => {
                const pct = sec.pct
                const r = Math.round(220 - pct * 120)
                const g = Math.round(220 + pct * 35)
                const b = Math.round(220 - pct * 130)
                const heatBg = pct === 0 ? '#f1f5f9' : `rgb(${r},${g},${b})`
                const textColor = pct > 0.6 ? '#fff' : 'var(--navy)'
                return (
                  <div key={sec.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 60px', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: heatBg, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{sec.title}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: textColor }}>{sec.selfDone}/{sec.total}</span>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct * 100}%`, background: pct > 0.6 ? 'rgba(255,255,255,0.6)' : bandColors[band], borderRadius: 3 }}/>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {sec.verified > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.5)', color: '#166534', borderRadius: 3, padding: '1px 5px' }}>✓{sec.verified}</span>}
                      {sec.rejected > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.5)', color: 'var(--red)', borderRadius: 3, padding: '1px 5px' }}>✗{sec.rejected}</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: textColor, textAlign: 'right' }}>{Math.round(pct * 100)}%</div>
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

// ─── Rank change badge ────────────────────────────────────────
function RankChange({ delta }) {
  if (delta === 0 || delta === null) return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
      color: 'rgba(0,0,0,0.2)', letterSpacing: 0 }}>—</span>
  )
  const up = delta > 0
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
        color: up ? '#16A34A' : '#DC2626',
        background: up ? '#DCFCE7' : '#FEE2E2',
        border: `1px solid ${up ? '#86EFAC' : '#FCA5A5'}`,
        borderRadius: 5, padding: '1px 6px', lineHeight: 1.4,
      }}>
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </motion.span>
  )
}

// ─── Podium card (top 3) ──────────────────────────────────────
function PodiumCard({ student, rank, onSelect, rankDelta }) {
  const vXP = getVerifiedXP(student)
  const { g, c } = gradeLabel(vXP, student)
  const initial = student.name?.[0] || '?'
  const displayName = student.name?.split(' ')[0] || student.name

  const configs = {
    1: {
      avatarSize: 72, fontSize: 28, colHeight: 96,
      medal: '🥇', rankLabel: '1st',
      avatarBg: 'linear-gradient(145deg,#FDE68A,#F59E0B)',
      avatarBorder: '#F59E0B',
      glow: '0 0 0 4px rgba(245,158,11,0.25), 0 12px 32px rgba(245,158,11,0.35)',
      colBg: 'linear-gradient(180deg,rgba(253,211,77,0.18) 0%,rgba(253,211,77,0.06) 100%)',
      colBorder: 'rgba(253,211,77,0.45)',
      xpColor: '#FCD34D',
    },
    2: {
      avatarSize: 58, fontSize: 22, colHeight: 68,
      medal: '🥈', rankLabel: '2nd',
      avatarBg: 'linear-gradient(145deg,#E2E8F0,#94A3B8)',
      avatarBorder: '#94A3B8',
      glow: '0 0 0 3px rgba(148,163,184,0.25), 0 8px 24px rgba(148,163,184,0.3)',
      colBg: 'linear-gradient(180deg,rgba(203,213,225,0.18) 0%,rgba(203,213,225,0.06) 100%)',
      colBorder: 'rgba(203,213,225,0.4)',
      xpColor: '#CBD5E1',
    },
    3: {
      avatarSize: 52, fontSize: 20, colHeight: 48,
      medal: '🥉', rankLabel: '3rd',
      avatarBg: 'linear-gradient(145deg,#FCD34D,#B45309)',
      avatarBorder: '#CD7F32',
      glow: '0 0 0 3px rgba(205,127,50,0.2), 0 8px 20px rgba(205,127,50,0.3)',
      colBg: 'linear-gradient(180deg,rgba(205,127,50,0.18) 0%,rgba(205,127,50,0.06) 100%)',
      colBorder: 'rgba(205,127,50,0.4)',
      xpColor: '#F0A060',
    },
  }
  const cfg = configs[rank]
  const initAnim = rank === 1 ? { opacity: 0, y: -24, scale: 0.88 }
    : rank === 2 ? { opacity: 0, x: -18, scale: 0.92 }
    : { opacity: 0, x: 18, scale: 0.92 }
  const delay = rank === 1 ? 0.08 : rank === 2 ? 0.22 : 0.28

  return (
    <motion.div
      initial={initAnim}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 22 }}
      onClick={() => onSelect(student)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'pointer', flex: 1, minWidth: 0, position: 'relative' }}>

      {/* Rank change indicator */}
      <div style={{ height: 22, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {rankDelta !== null && rankDelta !== 0 ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.3, type: 'spring', stiffness: 400 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800,
              color: rankDelta > 0 ? '#4ADE80' : '#F87171',
              background: rankDelta > 0 ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)',
              border: `1px solid ${rankDelta > 0 ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
              borderRadius: 5, padding: '1px 6px',
            }}>
            {rankDelta > 0 ? '▲' : '▼'}{Math.abs(rankDelta)}
          </motion.span>
        ) : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>—</span>}
      </div>

      {/* Avatar */}
      <motion.div
        whileHover={{ scale: 1.07, y: -4 }} whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 380, damping: 20 }}
        style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{
          width: cfg.avatarSize, height: cfg.avatarSize, borderRadius: '50%',
          background: cfg.avatarBg,
          border: `3px solid ${cfg.avatarBorder}`,
          boxShadow: cfg.glow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-head)', fontSize: cfg.fontSize, fontWeight: 900,
          color: '#fff', userSelect: 'none',
          textShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}>{initial}</div>
        <div style={{
          position: 'absolute', bottom: -3, right: -5,
          fontSize: rank === 1 ? 20 : 16, lineHeight: 1,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        }}>{cfg.medal}</div>
      </motion.div>

      {/* Name */}
      <div style={{
        fontSize: rank === 1 ? 13 : 12, fontWeight: 700, color: '#fff',
        textAlign: 'center', maxWidth: 80,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 2, textShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}>{displayName}</div>

      {/* XP */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: rank === 1 ? 12 : 10,
        fontWeight: 700, color: cfg.xpColor, marginBottom: 2,
      }}>⬆ {vXP.toLocaleString()} XP</div>

      {/* Grade pill */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        background: c + '28', color: c, padding: '1px 8px',
        borderRadius: 99, border: `1px solid ${c}44`, marginBottom: 10,
      }}>{g || '—'}</div>

      {/* Podium column — animated scaleY */}
      <motion.div
        initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
        transition={{ delay: delay + 0.18, duration: 0.45, ease: [0.22, 1.2, 0.64, 1] }}
        style={{ transformOrigin: 'bottom', width: '100%' }}>
        <div style={{
          width: '100%', height: cfg.colHeight,
          borderRadius: '10px 10px 0 0',
          background: cfg.colBg,
          border: `1.5px solid ${cfg.colBorder}`,
          borderBottom: 'none',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 3,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: rank === 1 ? 20 : 15,
            fontWeight: 900, color: cfg.xpColor, lineHeight: 1,
          }}>{cfg.rankLabel}</div>
          <div style={{ fontSize: rank === 1 ? 16 : 13 }}>{cfg.medal}</div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Tier divider ─────────────────────────────────────────────
function TierDivider({ label, color, bg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 8px' }}>
      <div style={{ flex: 1, height: 1, background: color + '40' }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        color, background: bg, padding: '3px 12px', borderRadius: 99,
        border: `1px solid ${color}55`, letterSpacing: '0.08em'
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: color + '40' }} />
    </div>
  )
}

// ─── Leaderboard tab ───────────────────────────────────────────
function LeaderboardTab({ students }) {
  const [breakdown, setBreakdown] = useState(null)
  const [groupFilter, setGroupFilter] = useState('all')

  // Rank change tracking via sessionStorage
  const sorted = [...students].sort((a, b) => getVerifiedXP(b) - getVerifiedXP(a))
  const SESSION_KEY = 'tutor_lb_prev_ranks'
  const prevRanks = (() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
  })()
  const currentRanks = {}
  sorted.forEach((s, i) => { currentRanks[s.studentId] = i + 1 })
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentRanks)) } catch {}

  // Apply group filter AFTER rank calculation so rank numbers stay consistent
  const filtered = groupFilter === 'all' ? sorted
    : sorted.filter(s => STUDENT_GROUPS[s.studentId] === groupFilter)

  function getRankDelta(studentId) {
    if (!prevRanks || !(studentId in prevRanks)) return null
    return prevRanks[studentId] - currentRanks[studentId]
  }

  const top3   = filtered.slice(0, 3)
  const rest   = filtered.slice(3)
  const top5   = rest.slice(0, 2)
  const top10  = rest.slice(2, 7)
  const others = rest.slice(7)
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3

  function openBreakdown(s) {
    setBreakdown({ ...s, completedTimestamps: s.completedTimestamps || {} })
  }

  function StudentRow({ s, rowRank }) {
    const vXP = getVerifiedXP(s)
    const { g, c } = gradeLabel(vXP, s)
    const completed = s.completedSections || []
    const passD  = SECTIONS.filter(x => x.band === 'pass'        && completed.includes(x.id)).length
    const meritD = SECTIONS.filter(x => x.band === 'merit'       && completed.includes(x.id)).length
    const distD  = SECTIONS.filter(x => x.band === 'distinction' && completed.includes(x.id)).length
    const passT  = SECTIONS.filter(x => x.band === 'pass').length
    const earnedBadges = BADGES.filter(b => (s.badges || []).includes(b.id))
    const schedStatus = getScheduleStatus(completed)
    const initial = s.name?.[0] || '?'
    const group = STUDENT_GROUPS[s.studentId]
    const groupColor = group === 'A' ? '#1D4ED8' : group === 'B' ? '#6D28D9' : group === 'C' ? '#065F46' : 'var(--slate)'
    const groupBg    = group === 'A' ? '#DBEAFE' : group === 'B' ? '#F3E8FF' : group === 'C' ? '#D1FAE5' : 'var(--light)'
    const isTop5 = rowRank <= 5
    const delta = getRankDelta(s.studentId)

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (rowRank - 4) * 0.03 }}
        onClick={() => openBreakdown(s)}
        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        style={{
          background: 'var(--white)', borderRadius: 10, cursor: 'pointer',
          transition: 'box-shadow 0.15s',
          border: isTop5 ? '1.5px solid #FCD34D55' : '1.5px solid var(--border)',
          overflow: 'hidden',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
          {/* Rank */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: isTop5 ? '#FEF9C3' : 'var(--light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
            color: isTop5 ? '#B45309' : 'var(--slate)',
            border: isTop5 ? '1px solid #FCD34D' : 'none',
          }}>{rowRank}</div>

          {/* Avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'var(--pass-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 900,
            color: 'var(--pass)',
          }}>{initial}</div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{s.name}</span>
              {group && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                  background: groupBg, color: groupColor, padding: '1px 5px', borderRadius: 3 }}>{group}</span>
              )}
              {schedStatus && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  background: schedStatus.bg, color: schedStatus.color,
                  border: `1px solid ${schedStatus.border}`, padding: '1px 6px', borderRadius: 4,
                }}>{schedStatus.label}</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 1 }}>
              {s.studentId} · P {passD}/{passT} · M {meritD}/{SECTIONS.filter(x => x.band === 'merit').length} · D {distD}/{SECTIONS.filter(x => x.band === 'distinction').length}
              {(s.streak || 0) > 1 && <span style={{ marginLeft: 6, color: '#F97316', fontWeight: 700 }}>🔥 {s.streak}d</span>}
            </div>
          </div>

          {/* XP + grade + rank change */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {earnedBadges.length > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)', fontWeight: 700 }}>🏅{earnedBadges.length}</span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{vXP} XP</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: c + '22', color: c, padding: '2px 7px', borderRadius: 4 }}>{g}</span>
            </div>
            {delta !== null && <RankChange delta={delta} />}
          </div>
        </div>

        {/* Badge row */}
        {earnedBadges.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4,
            padding: '6px 14px 8px', paddingLeft: 68,
            borderTop: '1px solid var(--border)', background: 'var(--light)',
          }}>
            {earnedBadges.map(b => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: 'var(--white)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '2px 6px',
              }}>
                <span style={{ fontSize: 11 }}>{b.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--navy)' }}>{b.name}</span>
                {b.xpBonus > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--gold)', fontWeight: 700 }}>+{b.xpBonus}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div>
      <AnimatePresence>
        {breakdown && <XPBreakdownModal student={breakdown} onClose={() => setBreakdown(null)} />}
      </AnimatePresence>

      {/* Group filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        {['all','A','B','C'].map(g => (
          <button key={g} onClick={() => setGroupFilter(g)}
            style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              background: groupFilter === g ? 'var(--navy)' : 'var(--white)',
              color: groupFilter === g ? '#fff' : 'var(--slate)',
              border: `1.5px solid ${groupFilter === g ? 'var(--navy)' : 'var(--border)'}`,
              transition: 'all 0.15s' }}>
            {g === 'all' ? `All (${students.length})` : `Group ${g} (${students.filter(s => STUDENT_GROUPS[s.studentId] === g).length})`}
          </button>
        ))}
        {groupFilter !== 'all' && (
          <span style={{ fontSize: 11, color: 'var(--slate)', marginLeft: 4 }}>
            Showing {filtered.length} student{filtered.length !== 1 ? 's' : ''} · ranks based on full cohort
          </span>
        )}
      </div>
      {top3.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #1a2035 100%)',
            borderRadius: 18, padding: '18px 14px 0', marginBottom: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            overflow: 'hidden', position: 'relative',
          }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(253,211,77,0.07) 0%, transparent 60%)',
          }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: 'rgba(253,211,77,0.55)', textAlign: 'center', letterSpacing: '0.14em',
            marginBottom: 18, textTransform: 'uppercase', position: 'relative' }}>🏆 Top of the Class</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, position: 'relative' }}>
            {podiumOrder.map((s, posInPodium) => {
              // podiumOrder is [2nd, 1st, 3rd] — map position back to rank 1/2/3
              const rank = top3.length === 3 ? [2, 1, 3][posInPodium] : posInPodium + 1
              return (
                <PodiumCard
                  key={s.studentId}
                  student={s}
                  rank={rank}
                  onSelect={openBreakdown}
                  rankDelta={getRankDelta(s.studentId)}
                />
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Ranks 4–5 */}
      {top5.length > 0 && (
        <>
          <TierDivider label="TOP 5" color="#B45309" bg="#FEF3C7" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top5.map((s, i) => <StudentRow key={s.studentId} s={s} rowRank={i + 4} />)}
          </div>
        </>
      )}

      {/* Ranks 6–10 */}
      {top10.length > 0 && (
        <>
          <TierDivider label="TOP 10" color="var(--pass)" bg="var(--pass-light)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top10.map((s, i) => <StudentRow key={s.studentId} s={s} rowRank={i + 6} />)}
          </div>
        </>
      )}

      {/* Rest */}
      {others.length > 0 && (
        <>
          <TierDivider label="THE REST" color="var(--slate)" bg="var(--light)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {others.map((s, i) => <StudentRow key={s.studentId} s={s} rowRank={i + 11} />)}
          </div>
        </>
      )}
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

    const newBadges = checkBadges(finalSections, 0, student.streak || 1, overrides)
    const allBadges = [...new Set([...(student.badges || []), ...newBadges])]
    const newXP = calcXP(finalSections, allBadges, newEarlyBonuses)

    await saveTutorOverrides(student.studentId, {
      completedSections: finalSections, xp: newXP, badges: allBadges,
      tutorOverrides: overrides, tutorNote: note, earlyBonuses: newEarlyBonuses,
      verifyTimestamps: verifyTimestamps.current,
    })
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
  const [tab, setTab] = useState('students')
  const [groupFilter, setGroupFilter] = useState('all')
  const [neverLoggedInFilter, setNeverLoggedInFilter] = useState(false)
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
      message: 'This recalculates every student XP from scratch based on actual completed sections, badges, and early bonuses. Fixes any stale or incorrect XP values.',
      requireWord: 'RECALC',
      onConfirm: async () => {
        const updated = []
        for (const s of students) {
          const milestone = calcMilestoneBonus(s.completedSections || [], s.milestoneBonus || 0)
          const newXP = calcXP(s.completedSections || [], s.badges || [], s.earlyBonuses || {}, milestone)
          if (newXP !== s.xp) {
            await upsertStudent(s.studentId, { ...s, xp: newXP })
            updated.push({ ...s, xp: newXP })
          } else {
            updated.push(s)
          }
        }
        setStudents(updated.sort((a, b) => (b.xp || 0) - (a.xp || 0)))
        setConfirm(null)
      }
    })
  }

  async function handleRecalcBadges() {
    setConfirm({
      icon: '🏅', title: 'Recalculate all badges?',
      message: 'This will strip any badges earned from self-reported sections and recalculate XP based on tutor-verified sections only.',
      requireWord: 'RECALC',
      onConfirm: async () => {
        const updated = []
        for (const s of students) {
          const overrides = s.tutorOverrides || {}
          const verifiedSections = (s.completedSections || []).filter(id => overrides[id] === true)
          const newBadges = checkBadges(verifiedSections, 0, s.streak || 1, overrides)
          const newXP = calcXP(s.completedSections || [], newBadges, s.earlyBonuses || {})
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

  const [sortBy, setSortBy] = useState('xp') // 'xp' | 'name' | 'pass' | 'status' | 'streak'

  const totalStudents      = students.length
  const submittedPass      = students.filter(s => gradeLabel(0, s).g !== '—').length
  const submittedMerit     = students.filter(s => ['M','D*'].includes(gradeLabel(0, s).g)).length
  const predictedPass      = students.filter(s => predictGrade(s).g !== '—').length
  const predictedMerit     = students.filter(s => ['M','D*'].includes(predictGrade(s).g)).length
  const stalledCount       = students.filter(s => predictGrade(s).stalledDays >= 5).length

  // Students in ROSTER but not in Firebase at all = never signed up
  const firebaseIds        = new Set(students.map(s => s.studentId))
  const notRegistered      = Object.entries(STUDENT_ROSTER)
    .filter(([id]) => id !== 'TEST' && !firebaseIds.has(id))
    .map(([id, name]) => ({ studentId: id, name, notRegistered: true }))
  const notRegisteredCount = notRegistered.length

  // Students in Firebase but never logged in (no lastSeen, no completedSections)
  const neverLoggedIn      = students.filter(s => !s.lastSeen && !(s.completedSections?.length))
  const neverLoggedInCount = neverLoggedIn.length

  const behindCount        = students.filter(s => {
    const st = getScheduleStatus(s.completedSections)
    return st?.label === 'Behind'
  }).length

  const filtered = (() => {
    if (neverLoggedInFilter) {
      const firebaseNever = students.filter(s => !s.lastSeen && !(s.completedSections?.length))
      return [...firebaseNever, ...notRegistered]
    }
    return students.filter(s => {
      if (groupFilter !== 'all' && STUDENT_GROUPS[s.studentId] !== groupFilter) return false
      return !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(search.toLowerCase())
    }).sort((a, b) => {
      if (sortBy === 'xp')     return getVerifiedXP(b) - getVerifiedXP(a)
      if (sortBy === 'name')   return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'pass')   return (b.completedSections || []).filter(id => SECTIONS.find(s => s.id === id && s.band === 'pass')).length - (a.completedSections || []).filter(id => SECTIONS.find(s => s.id === id && s.band === 'pass')).length
      if (sortBy === 'streak') return (b.streak || 0) - (a.streak || 0)
      if (sortBy === 'status') {
        const order = { 'Behind': 0, 'Slightly Behind': 1, 'On Track': 2, 'Ahead': 3 }
        return (order[getScheduleStatus(a.completedSections)?.label] ?? 2) - (order[getScheduleStatus(b.completedSections)?.label] ?? 2)
      }
      return 0
    })
  })()

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

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Total Students',   val: totalStudents,  color: 'var(--navy)',  sub: null },
            { label: 'Achieved Pass+',   val: submittedPass,  color: 'var(--pass)',  sub: `${predictedPass} projected by deadline` },
            { label: 'Achieved Merit+',  val: submittedMerit, color: 'var(--merit)', sub: `${predictedMerit} projected by deadline` },
            { label: 'Behind Schedule',  val: behindCount,         color: 'var(--red)',   sub: `${stalledCount} stalled 5+ days` },
            { label: 'Not on Platform',  val: notRegisteredCount + neverLoggedInCount, color: '#7C3AED', sub: `${notRegisteredCount} not signed up · ${neverLoggedInCount} no activity` },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--white)', borderRadius: 12,
              padding: '16px 18px', border: '1.5px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, color: stat.color }}>{stat.val}</div>
              <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>{stat.label}</div>
              {stat.sub && <div style={{ fontSize: 11, color: stat.color, marginTop: 4, fontWeight: 600, opacity: 0.75 }}>📈 {stat.sub}</div>}
            </div>
          ))}
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
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search student name or ID..."
                style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14 }}
                onFocus={e => e.target.style.borderColor='var(--navy)'}
                onBlur={e => e.target.style.borderColor='var(--border)'}/>
              <button onClick={() => setEditModal(false)}
                style={{ padding: '9px 18px', background: 'var(--pass)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                + Add Student
              </button>
            </div>
            {/* Group filter + sort row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {['all','A','B','C'].map(g => (
                  <button key={g} onClick={() => { setGroupFilter(g); setNeverLoggedInFilter(false) }}
                    style={{ padding: '5px 13px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: groupFilter === g && !neverLoggedInFilter ? 'var(--navy)' : 'var(--white)',
                      color: groupFilter === g && !neverLoggedInFilter ? '#fff' : 'var(--slate)',
                      border: `1.5px solid ${groupFilter === g && !neverLoggedInFilter ? 'var(--navy)' : 'var(--border)'}` }}>
                    {g === 'all' ? `All (${students.length})` : `Grp ${g} (${students.filter(s => STUDENT_GROUPS[s.studentId] === g).length})`}
                  </button>
                ))}
                <button onClick={() => { setNeverLoggedInFilter(v => !v); setGroupFilter('all') }}
                  style={{ padding: '5px 13px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: neverLoggedInFilter ? '#7C3AED' : 'var(--white)',
                    color: neverLoggedInFilter ? '#fff' : '#7C3AED',
                    border: `1.5px solid ${neverLoggedInFilter ? '#7C3AED' : '#C4B5FD'}` }}>
                  👻 Not on platform ({notRegisteredCount + neverLoggedInCount})
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <span style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 600 }}>Sort:</span>
                {[
                  { id: 'xp',     label: 'XP' },
                  { id: 'name',   label: 'Name' },
                  { id: 'pass',   label: 'Pass §' },
                  { id: 'streak', label: 'Streak' },
                  { id: 'status', label: 'Status' },
                ].map(s => (
                  <button key={s.id} onClick={() => setSortBy(s.id)}
                    style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                      background: sortBy === s.id ? 'var(--navy)' : 'var(--white)',
                      color: sortBy === s.id ? '#fff' : 'var(--slate)',
                      border: `1.5px solid ${sortBy === s.id ? 'var(--navy)' : 'var(--border)'}` }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Action buttons row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
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
              <div style={{ background: 'var(--white)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '52px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '70px' }} />
                    <col style={{ width: '90px' }} />
                    <col style={{ width: '70px' }} />
                    <col style={{ width: '80px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '96px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--light)', borderBottom: '2px solid var(--border)' }}>
                      {['Student', 'Grp', 'XP', 'Grade', 'Projected', 'Badges', 'Streak', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)',
                          fontSize: 10, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase',
                          letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const isNotRegistered = s.notRegistered === true
                      const group      = STUDENT_GROUPS[s.studentId]
                      const groupColor = group === 'A' ? '#1D4ED8' : group === 'B' ? '#6D28D9' : group === 'C' ? '#065F46' : 'var(--slate)'
                      const groupBg    = group === 'A' ? '#DBEAFE' : group === 'B' ? '#F3E8FF' : group === 'C' ? '#D1FAE5' : 'var(--light)'

                      // Ghost row — in roster but never signed up
                      if (isNotRegistered) {
                        return (
                          <tr key={s.studentId} style={{ borderBottom: '1px solid var(--border)', background: '#faf5ff', opacity: 0.85 }}>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>
                                {s.name}
                                <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                  background: '#7C3AED', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>NOT REGISTERED</span>
                              </div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 2 }}>{s.studentId}</div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {group
                                ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: groupBg, color: groupColor, padding: '2px 8px', borderRadius: 4 }}>{group}</span>
                                : <span style={{ color: 'var(--slate)' }}>—</span>}
                            </td>
                            {['','','','','','',''].map((_, ci) => (
                              <td key={ci} style={{ padding: '12px 14px', color: '#cbd5e1', fontSize: 12 }}>—</td>
                            ))}
                          </tr>
                        )
                      }

                      const vXP = getVerifiedXP(s)
                      const { g, c } = gradeLabel(vXP, s)
                      const completed = s.completedSections || []
                      const passD  = SECTIONS.filter(x => x.band === 'pass'        && completed.includes(x.id)).length
                      const meritD = SECTIONS.filter(x => x.band === 'merit'       && completed.includes(x.id)).length
                      const distD  = SECTIONS.filter(x => x.band === 'distinction' && completed.includes(x.id)).length
                      const passT  = SECTIONS.filter(x => x.band === 'pass').length
                      const meritT = SECTIONS.filter(x => x.band === 'merit').length
                      const distT  = SECTIONS.filter(x => x.band === 'distinction').length
                      const totalDone = completed.length
                      const totalSections = SECTIONS.length
                      const verifiedIds = Object.entries(s.tutorOverrides || {}).filter(([,v]) => v === true).map(([k]) => k)
                      const hasRejections = Object.values(s.tutorOverrides || {}).includes(false)
                      const neverSeen = !s.lastSeen && !(s.completedSections?.length)
                      const schedStatus = getScheduleStatus(completed)
                      const pred = predictGrade(s)
                      const donePct     = totalDone / totalSections
                      const verifiedPct = verifiedIds.length / totalSections

                      return (
                        <tr key={s.studentId}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer',
                            background: i % 2 === 0 ? 'var(--white)' : '#fafbfc', transition: 'background 0.1s' }}
                          onClick={() => setModal(s)}
                          onMouseEnter={e => e.currentTarget.style.background='#EEF2FF'}
                          onMouseLeave={e => e.currentTarget.style.background=i%2===0?'var(--white)':'#fafbfc'}>

                          {/* Student name */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isNotRegistered ? '#7C3AED' : 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.name || '—'}
                              {hasRejections && <span style={{ marginLeft: 5, fontSize: 10 }}>⚠️</span>}
                              {isNotRegistered && (
                                <span title="Not signed up to the platform"
                                  style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                    background: '#7C3AED', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>NOT REGISTERED</span>
                              )}
                              {!isNotRegistered && neverSeen && (
                                <span title="Signed up but never logged in or submitted anything"
                                  style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                    background: '#EDE9FE', color: '#7C3AED', padding: '1px 5px', borderRadius: 3 }}>NO ACTIVITY</span>
                              )}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 2 }}>{s.studentId}</div>
                          </td>

                          {/* Group */}
                          <td style={{ padding: '12px 14px' }}>
                            {group
                              ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: groupBg, color: groupColor, padding: '2px 8px', borderRadius: 4 }}>{group}</span>
                              : <span style={{ color: 'var(--slate)', fontSize: 11 }}>—</span>}
                          </td>

                          {/* XP */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{vXP.toLocaleString()}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 1 }}>/ {calcXP(s.completedSections || [], s.badges || [], s.earlyBonuses || {}, s.milestoneBonus || 0).toLocaleString()} self</div>
                          </td>

                          {/* Grade */}
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                              background: c + '22', color: c, padding: '3px 9px', borderRadius: 5 }}>{g}</span>
                          </td>

                          {/* Projected */}
                          <td style={{ padding: '12px 14px' }}>
                            {pred.g !== g ? (
                              <div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                                  background: pred.c + '18', color: pred.c, padding: '3px 9px', borderRadius: 5,
                                  border: `1.5px dashed ${pred.c}88` }}>~{pred.g}</span>
                                <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {pred.stalledDays >= 5 && (
                                    <span title={`No activity for ${pred.stalledDays} days`}
                                      style={{ fontSize: 10, color: '#F97316', fontWeight: 700 }}>⏸ {pred.stalledDays}d</span>
                                  )}
                                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                    color: pred.confidence === 'high' ? '#16A34A' : pred.confidence === 'medium' ? '#B45309' : '#DC2626',
                                    opacity: 0.8 }}>
                                    {pred.confidence === 'high' ? '●●●' : pred.confidence === 'medium' ? '●●○' : '●○○'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* Badges */}
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: (s.badges||[]).length > 0 ? 'var(--gold)' : 'var(--slate)', fontWeight: 700 }}>
                              {(s.badges || []).length > 0 ? `🏅 ${(s.badges||[]).length}` : '—'}
                            </span>
                          </td>

                          {/* Streak */}
                          <td style={{ padding: '12px 14px' }}>
                            {(s.streak || 0) > 1
                              ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#F97316' }}>🔥 {s.streak}d</span>
                              : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 14px' }}>
                            {schedStatus && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                                background: schedStatus.bg, color: schedStatus.color,
                                border: `1px solid ${schedStatus.border}`,
                                padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                {schedStatus.label}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => setBreakdown({...s, completedTimestamps: s.completedTimestamps || {}})}
                                title="XP Breakdown"
                                style={{ fontSize: 14, padding: '4px 7px', borderRadius: 5, background: '#f0fdf4', color: 'var(--pass)', fontWeight: 700, border: 'none', cursor: 'pointer' }}>📊</button>
                              <button onClick={() => setEditModal(s)}
                                title="Edit"
                                style={{ fontSize: 14, padding: '4px 7px', borderRadius: 5, background: '#EEF2FF', color: '#6366F1', fontWeight: 700, border: 'none', cursor: 'pointer' }}>✏️</button>
                              <button onClick={() => handleDelete(s)}
                                title="Delete"
                                style={{ fontSize: 14, padding: '4px 7px', borderRadius: 5, background: 'var(--red-light)', color: 'var(--red)', fontWeight: 700, border: 'none', cursor: 'pointer' }}>🗑️</button>
                            </div>
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