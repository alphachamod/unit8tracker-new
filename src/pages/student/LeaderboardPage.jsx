import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllStudents } from '../../lib/firebase'
import { TOTAL_XP, PASS_XP, PASS_MERIT_XP, BADGES, SECTIONS, calcVerifiedXP } from '../../data/gameData'

// ─── XP Breakdown Modal ────────────────────────────────────────
function XPBreakdownModal({ student, isMe, onClose }) {
  const verified = SECTIONS.filter(s => student.tutorOverrides?.[s.id] === true)
  const selfOnly = (student.completedSections || []).filter(id => student.tutorOverrides?.[id] !== true)
  const earnedBadges = BADGES.filter(b => (student.badges || []).includes(b.id))
  const earlyBonuses = student.earlyBonuses || {}
  const verifyTimestamps = student.verifyTimestamps || {}

  const baseXP = verified.reduce((a, s) => a + s.xp, 0)
  const badgeXP = earnedBadges.reduce((a, b) => a + b.xpBonus, 0)
  const earlyXP = Object.values(earlyBonuses).reduce((a, v) => a + v, 0)
  const totalXP = student.xp || 0

  const bandColors = {
    pass:        { color: 'var(--pass)',  bg: 'var(--pass-light)',  border: 'var(--pass-mid)' },
    merit:       { color: 'var(--merit)', bg: '#fffbeb',            border: '#FCD34D' },
    distinction: { color: 'var(--dist)',  bg: '#fff7ed',            border: '#FDBA74' },
  }

  function formatDate(ts) {
    if (!ts) return null
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function getEarlyLabel(bonus) {
    if (bonus >= 40) return { text: 'Very Early', color: '#7C3AED' }
    if (bonus >= 20) return { text: 'Early',      color: '#2563EB' }
    return                  { text: 'Slightly Early', color: '#0891B2' }
  }

  const firstName = student.name?.split(' ')[0] || 'Student'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(10,15,30,0.65)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 520,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--navy)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 900, color: '#fff' }}>
              {isMe ? student.name + ' (you)' : firstName}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              XP Breakdown
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 900, color: '#FCD34D' }}>
                {totalXP} XP
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>verified total</div>
            </div>
            <button onClick={onClose} style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 22px', borderBottom: '1px solid var(--border)',
          background: 'var(--light)', flexWrap: 'wrap' }}>
          {[
            { label: 'Section XP',  val: baseXP,  color: 'var(--navy)' },
            { label: 'Badge XP',    val: badgeXP,  color: 'var(--gold)' },
            { label: 'Early Bonus', val: earlyXP,  color: '#7C3AED' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: 'var(--white)', border: '1.5px solid var(--border)',
              borderRadius: 8, padding: '8px 14px', textAlign: 'center', flex: 1, minWidth: 90 }}>
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
                  color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{band}</div>
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
                          {isMe && ts && (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--slate)', marginTop: 2 }}>
                              ✓ {formatDate(ts)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {earlyLabel && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                              color: earlyLabel.color, background: earlyLabel.color + '18',
                              border: `1px solid ${earlyLabel.color}44`, borderRadius: 4, padding: '1px 6px' }}>
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
                color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Badges</div>
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

          {/* Pending — only show to self */}
          {isMe && selfOnly.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Pending Verification
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selfOnly.map(id => {
                  const sec = SECTIONS.find(s => s.id === id)
                  if (!sec) return null
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--light)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 12px', opacity: 0.7 }}>
                      <span style={{ fontSize: 12, color: 'var(--slate)', flex: 1 }}>{sec.title}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>awaiting tutor</span>
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

// ─── Main leaderboard ──────────────────────────────────────────
export default function LeaderboardPage({ student }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [breakdown, setBreakdown] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    getAllStudents().then(all => {
      const sorted = all
        .map(s => ({
          studentId: s.studentId,
          name: s.name,
          xp: calcVerifiedXP(s.completedSections, s.badges, s.tutorOverrides, s.earlyBonuses),
          badges: s.badges || [],
          badgeIds: s.badges || [],
          completedSections: s.completedSections || [],
          tutorOverrides: s.tutorOverrides || {},
          earlyBonuses: s.earlyBonuses || {},
          verifyTimestamps: s.verifyTimestamps || {},
          streak: s.streak || 0,
        }))
        .sort((a, b) => b.xp - a.xp)
      setStudents(sorted)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function gradeLabel(xp) {
    if (xp >= TOTAL_XP)      return { label: 'Distinction', color: 'var(--dist)',   bg: 'var(--dist-light)' }
    if (xp >= PASS_MERIT_XP) return { label: 'Merit',       color: 'var(--merit)',  bg: 'var(--merit-light)' }
    if (xp >= PASS_XP)       return { label: 'Pass',        color: 'var(--pass)',   bg: 'var(--pass-light)' }
    return                          { label: '—',            color: 'var(--slate)',  bg: 'var(--light)' }
  }

  const myRank = students.findIndex(s => s.studentId === student.studentId) + 1

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Leaderboard</h2>
          <p style={{ color: 'var(--slate)', fontSize: 14 }}>Ranked by verified XP — tap any student to see their full breakdown.</p>
        </div>
        <button onClick={() => setShowGuide(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer',
            flexShrink: 0 }}>
          ⚡ How to Score
        </button>
      </div>

      {/* How to Score modal */}
      <AnimatePresence>
        {showGuide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowGuide(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(10,15,30,0.65)',
              backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 480,
                maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>

              {/* Header */}
              <div style={{ padding: '18px 22px', background: 'var(--navy)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 900, color: '#fff' }}>
                    ⚡ How to Score XP
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Everything counts — verified work only
                  </div>
                </div>
                <button onClick={() => setShowGuide(false)}
                  style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Section XP */}
                <div style={{ background: 'var(--pass-light)', border: '1.5px solid var(--pass-mid)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: 'var(--pass)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    📋 Section XP
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.6, margin: 0 }}>
                    Each section you complete is worth XP. Pass sections are worth the most overall — you need all of them first.
                    Merit and Distinction sections build on top. <strong>XP only counts once Mr Ravindu verifies your work.</strong>
                  </p>
                </div>

                {/* Early bonus */}
                <div style={{ background: '#EDE9FE', border: '1.5px solid #C4B5FD', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    ⚡ Early Completion Bonus
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.6, margin: '0 0 10px' }}>
                    Complete a section <strong>before its week deadline</strong> and earn up to <strong>+50 bonus XP</strong>.
                    The earlier in the week you tick it, the bigger the bonus.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { label: 'Start of week', bonus: '~50 XP', color: '#7C3AED' },
                      { label: 'Midweek',       bonus: '~25 XP', color: '#2563EB' },
                      { label: 'End of week',   bonus: '~5 XP',  color: '#0891B2' },
                      { label: 'After deadline','bonus': '0 XP',  color: 'var(--slate)' },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', background: 'rgba(255,255,255,0.6)',
                        borderRadius: 6, padding: '6px 10px' }}>
                        <span style={{ fontSize: 12, color: 'var(--navy)' }}>{row.label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: row.color }}>{row.bonus}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 10, marginBottom: 0, fontStyle: 'italic' }}>
                    Bonus is based on when YOU tick the section — not when it gets verified.
                  </p>
                </div>

                {/* Badges */}
                <div style={{ background: '#fffbeb', border: '1.5px solid #FCD34D', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    🏅 Badges
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.6, margin: 0 }}>
                    Unlock badges by hitting milestones — completing your first section, finishing all Pass work,
                    achieving streaks, and more. Each badge is worth bonus XP on top of your section score.
                    Badges only unlock once your work is verified.
                  </p>
                </div>

                {/* Streaks */}
                <div style={{ background: '#FFF7ED', border: '1.5px solid #FDBA74', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    🔥 Streaks
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.6, margin: 0 }}>
                    Complete sections on <strong>consecutive days</strong> to build a streak.
                    Longer streaks unlock powerful badges worth up to <strong>+200 bonus XP</strong>.
                    Miss a day and your streak resets — so keep going!
                  </p>
                </div>

                {/* Leaderboard rule */}
                <div style={{ background: 'var(--light)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    🏆 Leaderboard Rule
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.6, margin: 0 }}>
                    Only <strong>verified XP</strong> appears on the leaderboard. Self-reported sections don't count
                    until Mr Ravindu checks them. Tap any student row to see the full breakdown of how they earned their XP.
                  </p>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {myRank > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--navy)', color: '#fff', borderRadius: 12, padding: '16px 20px',
            marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700 }}>
            Your position: #{myRank}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#FCD34D', fontWeight: 700 }}>
            {student.xp || 0} XP
          </span>
        </motion.div>
      )}

      <AnimatePresence>
        {breakdown && (
          <XPBreakdownModal
            student={breakdown}
            isMe={breakdown.studentId === student.studentId}
            onClose={() => setBreakdown(null)}
          />
        )}
      </AnimatePresence>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {students.map((s, i) => {
            const isMe = s.studentId === student.studentId
            const { label, color, bg } = gradeLabel(s.xp)
            const firstName = s.name?.split(' ')[0] || '—'
            const initial   = s.name?.[0] || '?'
            const earnedBadges = BADGES.filter(b => s.badgeIds.includes(b.id))

            return (
              <motion.div key={s.studentId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setBreakdown(s)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                style={{
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer', transition: 'box-shadow 0.15s',
                  background: isMe ? 'var(--navy)' : 'var(--white)',
                  border: `1.5px solid ${isMe ? 'var(--navy)' : i === 0 ? '#FCD34D' : i === 1 ? '#CBD5E1' : i === 2 ? '#D97706' : 'var(--border)'}`,
                  color: isMe ? '#fff' : 'var(--navy)',
                }}>

                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: earnedBadges.length > 0 ? 10 : 0 }}>
                  {/* Rank */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
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
                    background: isMe ? 'rgba(255,255,255,0.2)' : 'var(--pass-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 900,
                    color: isMe ? '#fff' : 'var(--pass)',
                  }}>{initial}</div>

                  {/* Name + badge count */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {isMe ? s.name + ' (you)' : firstName}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: isMe ? 'rgba(255,255,255,0.55)' : 'var(--slate)' }}>
                      {earnedBadges.length} badge{earnedBadges.length !== 1 ? 's' : ''}
                      {s.streak > 1 && <span style={{ marginLeft: 6, color: isMe ? '#FCD34D' : '#F97316', fontWeight: 700 }}>🔥 {s.streak}d streak</span>}
                      {' · tap for breakdown'}
                    </div>
                  </div>

                  {/* XP + grade */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                      color: isMe ? '#FCD34D' : 'var(--navy)',
                    }}>{s.xp} XP</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                      background: isMe ? 'rgba(255,255,255,0.15)' : bg,
                      color: isMe ? '#FCD34D' : color,
                      padding: '2px 8px', borderRadius: 4,
                    }}>{label}</span>
                  </div>
                </div>

                {/* Badge row */}
                {earnedBadges.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 72 }}>
                    {earnedBadges.map(b => (
                      <div key={b.id} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: isMe ? 'rgba(255,255,255,0.1)' : 'var(--light)',
                        border: `1px solid ${isMe ? 'rgba(255,255,255,0.15)' : 'var(--border)'}`,
                        borderRadius: 6, padding: '3px 8px',
                      }}>
                        <span style={{ fontSize: 13 }}>{b.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600,
                          color: isMe ? 'rgba(255,255,255,0.8)' : 'var(--navy)' }}>{b.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                          color: isMe ? '#FCD34D' : 'var(--gold)' }}>+{b.xpBonus}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}