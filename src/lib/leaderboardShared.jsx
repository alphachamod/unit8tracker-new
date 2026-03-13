import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SECTIONS, BADGES, TOTAL_XP, PASS_XP, PASS_MERIT_XP,
  calcVerifiedXP, getDaysElapsed, WEEKS_DATA, STUDENT_GROUPS,
} from '../data/gameData'

// ─── Helpers (exported so TutorDashboard can keep using them) ──

const PASS_IDS = SECTIONS.filter(s => s.band === 'pass').map(s => s.id)
const MERIT_IDS = SECTIONS.filter(s => s.band === 'merit').map(s => s.id)
const DIST_IDS = SECTIONS.filter(s => s.band === 'distinction').map(s => s.id)

export function getVerifiedGrade(s) {
  const ov = s.tutorOverrides || {}
  const isV = id => ov[id] === true
  if ([...PASS_IDS, ...MERIT_IDS, ...DIST_IDS].every(isV)) return { g: 'D*', c: 'var(--dist)' }
  if ([...PASS_IDS, ...MERIT_IDS].every(isV))               return { g: 'M',  c: 'var(--merit)' }
  if (PASS_IDS.every(isV))                                  return { g: 'P',  c: 'var(--pass)' }
  return                                                           { g: '—',  c: 'var(--slate)' }
}

export function getVerifiedXP(s) {
  return calcVerifiedXP(s.completedSections, s.badges, s.tutorOverrides, s.earlyBonuses, s.milestoneBonus || 0)
}

function getExpectedSections() {
  const now = new Date()
  const expected = []
  for (const week of WEEKS_DATA) {
    const weekEnd = new Date(week.end + 'T23:59:59')
    if (now >= weekEnd) {
      for (const item of week.items) {
        const ids = SECTIONS.filter(s => s.criteria === item.criteria).map(s => s.id)
        expected.push(...ids)
      }
    }
  }
  return [...new Set(expected)]
}

export function getScheduleStatus(completedSections) {
  const expected = getExpectedSections()
  if (expected.length === 0) return null

  const completed = completedSections || []
  const completedExpected = expected.filter(id => completed.includes(id)).length
  const ratio = completedExpected / expected.length

  const totalDone = completed.length
  const totalSections = SECTIONS.length
  const weekProgress = WEEKS_DATA.findIndex(w => {
    const now = new Date()
    return now >= new Date(w.start) && now <= new Date(w.end + 'T23:59:59')
  })
  const currentWeekIndex = weekProgress === -1 ? WEEKS_DATA.length - 1 : weekProgress
  const expectedTotal = Math.round((currentWeekIndex / WEEKS_DATA.length) * totalSections)

  if (totalDone > expectedTotal + 2) return { label: 'Ahead',           color: '#7C3AED', bg: '#EDE9FE', border: '#C4B5FD' }
  if (ratio >= 0.8)                  return { label: 'On Track',        color: 'var(--pass)', bg: 'var(--pass-light)', border: 'var(--pass-mid)' }
  if (ratio >= 0.5)                  return { label: 'Slightly Behind', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' }
  return                                    { label: 'Behind',          color: 'var(--red)', bg: 'var(--red-light)', border: '#FCA5A5' }
}

// ─── XP Breakdown Modal ────────────────────────────────────────
// isStudent: hides student ID and "pending verification" section from student view

export function XPBreakdownModal({ student, onClose, isStudent = false }) {
  const verified = SECTIONS.filter(s => student.tutorOverrides?.[s.id] === true)
  const selfOnly = (student.completedSections || []).filter(id => student.tutorOverrides?.[id] !== true)
  const earnedBadges = BADGES.filter(b => (student.badges || []).includes(b.id))
  const earlyBonuses = student.earlyBonuses || {}
  const verifyTimestamps = student.verifyTimestamps || {}
  const completedTimestamps = student.completedTimestamps || {}
  const verifiedIds = verified.map(s => s.id)

  const baseXP = verified.reduce((a, s) => a + s.xp, 0)
  // Trust earned badges — they were awarded at submission time
  const badgeXP = earnedBadges.reduce((a, b) => a + (b.xpBonus || 0), 0)
  const earlyXP = Object.entries(earlyBonuses)
    .filter(([id]) => student.tutorOverrides?.[id] === true)
    .reduce((a, [, v]) => a + v, 0)
  // Milestone: only count if verified sections satisfy the tier, capped at what was earned
  const week1Ids = ['s1','s2a','s2b','s2c','s2d','s2e','s2f','s2g']
  let milestoneXP = 0
  if (week1Ids.every(id => verifiedIds.includes(id)))   milestoneXP = Math.max(milestoneXP, 120)
  if (PASS_IDS.every(id => verifiedIds.includes(id)))   milestoneXP = Math.max(milestoneXP, 200)
  if ([...PASS_IDS,...MERIT_IDS].every(id => verifiedIds.includes(id))) milestoneXP = Math.max(milestoneXP, 300)
  if ([...PASS_IDS,...MERIT_IDS,...DIST_IDS].every(id => verifiedIds.includes(id))) milestoneXP = Math.max(milestoneXP, 500)
  milestoneXP = Math.min(milestoneXP, student.milestoneBonus || milestoneXP)
  const totalVerifiedXP = baseXP + badgeXP + earlyXP + milestoneXP

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

  const firstName = isStudent ? student.name?.split(' ')[0] : student.name

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
              {firstName}
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>verified total</div>
            </div>
            <button onClick={onClose} style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
          </div>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 22px', borderBottom: '1px solid var(--border)',
          background: 'var(--light)', flexWrap: 'wrap' }}>
          {[
            { label: 'Section XP',  val: baseXP,      color: 'var(--navy)' },
            { label: 'Badge XP',    val: badgeXP,      color: 'var(--gold)' },
            { label: 'Early Bonus', val: earlyXP,      color: '#7C3AED' },
            ...(milestoneXP > 0 ? [{ label: 'Milestone', val: milestoneXP, color: '#059669' }] : []),
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
                            {ts && <span>✓ Verified {formatDate(ts)}</span>}
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
                    {b.xpBonus > 0 && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                        +{b.xpBonus}
                      </span>
                    )}
                    {b.isMilestone && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#059669' }}>
                        🏅
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestone bonus (if not already shown as a badge) */}
          {milestoneXP > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Milestone Bonus
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '9px 12px' }}>
                <span style={{ fontSize: 18 }}>🏅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                    {milestoneXP >= 500 ? 'Full Send' : milestoneXP >= 300 ? 'Merit Sprinter' : milestoneXP >= 200 ? 'Pass Rusher' : 'Week 1 Sprint'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--slate)' }}>
                    Awarded for completing sections ahead of schedule
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#059669' }}>
                  +{milestoneXP}
                </span>
              </div>
            </div>
          )}

          {/* Self-reported (not yet verified) — hidden from student view */}
          {!isStudent && selfOnly.length > 0 && (
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

// ─── Shared Leaderboard List ───────────────────────────────────
// isStudent: hides student IDs, shows first name only for others

// ─── Rank change badge ────────────────────────────────────────
function RankChange({ delta }) {
  if (delta === 0 || delta === null) return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
      color: 'rgba(255,255,255,0.3)', letterSpacing: 0 }}>—</span>
  )
  const up = delta > 0
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.4 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
        color: up ? '#4ADE80' : '#F87171',
        background: up ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
        border: `1px solid ${up ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}`,
        borderRadius: 5, padding: '1px 5px', lineHeight: 1.4,
      }}>
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </motion.span>
  )
}

// ─── Podium card (top 3) ───────────────────────────────────────
function PodiumCard({ student, rank, isMe, isStudent, onSelect, rankDelta }) {
  const vXP = getVerifiedXP(student)
  const { g, c } = getVerifiedGrade(student)
  const initial = student.name?.[0] || '?'
  const displayName = isStudent
    ? (isMe ? student.name?.split(' ')[0] : student.name?.split(' ')[0] || 'Student')
    : student.name?.split(' ')[0] || student.name

  const cfg = {
    1: { avatarSize:72, fontSize:28, stageH:90, medal:'🥇', label:'1st',
         avatarBg:'linear-gradient(145deg,#FDE68A,#F59E0B)', border:'#F59E0B',
         glow:'0 0 0 4px rgba(245,158,11,0.3), 0 12px 32px rgba(245,158,11,0.45)',
         stageBg:'linear-gradient(180deg,#2a2010 0%,#1a1508 100%)',
         stageBorder:'rgba(253,211,77,0.5)', xpColor:'#FCD34D',
         initAnim:{ opacity:0, y:-30, scale:0.85 }, delay:0.05 },
    2: { avatarSize:58, fontSize:22, stageH:66, medal:'🥈', label:'2nd',
         avatarBg:'linear-gradient(145deg,#E2E8F0,#94A3B8)', border:'#94A3B8',
         glow:'0 0 0 3px rgba(148,163,184,0.3), 0 8px 24px rgba(148,163,184,0.4)',
         stageBg:'linear-gradient(180deg,#1e2530 0%,#141b24 100%)',
         stageBorder:'rgba(203,213,225,0.4)', xpColor:'#CBD5E1',
         initAnim:{ opacity:0, x:-24 }, delay:0.2 },
    3: { avatarSize:52, fontSize:20, stageH:48, medal:'🥉', label:'3rd',
         avatarBg:'linear-gradient(145deg,#FCD34D,#B45309)', border:'#CD7F32',
         glow:'0 0 0 3px rgba(205,127,50,0.25), 0 8px 20px rgba(205,127,50,0.4)',
         stageBg:'linear-gradient(180deg,#221808 0%,#180f05 100%)',
         stageBorder:'rgba(205,127,50,0.45)', xpColor:'#F0A060',
         initAnim:{ opacity:0, x:24 }, delay:0.25 },
  }[rank]

  return (
    <motion.div
      initial={cfg.initAnim}
      animate={{ opacity:1, y:0, x:0, scale:1 }}
      transition={{ delay:cfg.delay, type:'spring', stiffness:240, damping:22 }}
      onClick={() => onSelect(student)}
      style={{ display:'flex', flexDirection:'column', alignItems:'center',
        cursor:'pointer', flex:1, minWidth:0 }}>

      {/* Rank change */}
      <div style={{ height:22, marginBottom:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {rankDelta !== null && rankDelta !== 0 ? (
          <motion.span
            initial={{ opacity:0, scale:0.5 }} animate={{ opacity:1, scale:1 }}
            transition={{ delay:cfg.delay + 0.35, type:'spring', stiffness:400 }}
            style={{
              display:'inline-flex', alignItems:'center', gap:2,
              fontFamily:'var(--font-mono)', fontSize:10, fontWeight:800,
              color: rankDelta > 0 ? '#4ADE80' : '#F87171',
              background: rankDelta > 0 ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)',
              border:`1px solid ${rankDelta > 0 ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
              borderRadius:5, padding:'1px 6px',
            }}>
            {rankDelta > 0 ? '▲' : '▼'}{Math.abs(rankDelta)}
          </motion.span>
        ) : (
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.18)', fontFamily:'var(--font-mono)' }}>—</span>
        )}
      </div>

      {/* Avatar */}
      <motion.div
        whileHover={{ scale:1.08, y:-5 }} whileTap={{ scale:0.95 }}
        transition={{ type:'spring', stiffness:380, damping:20 }}
        style={{ position:'relative', marginBottom:10 }}>

        <div style={{
          width:cfg.avatarSize, height:cfg.avatarSize, borderRadius:'50%',
          background: isMe ? 'linear-gradient(145deg,#1F6B3A,#2ecc71)' : cfg.avatarBg,
          border:`3px solid ${isMe ? '#4ADE80' : cfg.border}`,
          boxShadow: isMe
            ? '0 0 0 4px rgba(74,222,128,0.28), 0 10px 30px rgba(74,222,128,0.4)'
            : cfg.glow,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--font-head)', fontSize:cfg.fontSize, fontWeight:900,
          color:'#fff', userSelect:'none',
          textShadow:'0 2px 6px rgba(0,0,0,0.4)',
        }}>{initial}</div>

        {/* Medal */}
        <div style={{
          position:'absolute', bottom:-2, right:-5,
          fontSize: rank===1 ? 20 : 16, lineHeight:1,
          filter:'drop-shadow(0 2px 5px rgba(0,0,0,0.55))',
        }}>{cfg.medal}</div>

        {/* YOU tag */}
        {isMe && (
          <motion.div
            initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:cfg.delay + 0.4 }}
            style={{
              position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)',
              background:'#4ADE80', color:'#052e16',
              fontSize:8, fontWeight:800, padding:'1px 7px',
              borderRadius:99, fontFamily:'var(--font-mono)',
              whiteSpace:'nowrap', boxShadow:'0 2px 10px rgba(74,222,128,0.6)',
              letterSpacing:'0.05em',
            }}>YOU</motion.div>
        )}
      </motion.div>

      {/* Name */}
      <div style={{
        fontSize: rank===1 ? 13 : 12, fontWeight:700, color:'#fff',
        textAlign:'center', maxWidth:85,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        marginBottom:2, textShadow:'0 1px 5px rgba(0,0,0,0.5)',
      }}>{displayName}</div>

      {/* XP */}
      <div style={{
        fontFamily:'var(--font-mono)', fontSize: rank===1 ? 12 : 10,
        fontWeight:700, color:cfg.xpColor, marginBottom:3,
      }}>⬆ {vXP.toLocaleString()} XP</div>

      {/* Grade pill */}
      <div style={{
        fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700,
        background: c + '28', color:c, padding:'1px 8px',
        borderRadius:99, border:`1px solid ${c}44`, marginBottom:8,
      }}>{g || '—'}</div>

      {/* Stage block — scales up from bottom */}
      <motion.div
        initial={{ scaleY:0 }} animate={{ scaleY:1 }}
        transition={{ delay:cfg.delay + 0.2, duration:0.5, ease:[0.22,1.18,0.64,1] }}
        style={{ transformOrigin:'bottom', width:'100%' }}>
        <div style={{
          width:'100%', height:cfg.stageH,
          borderRadius:'12px 12px 0 0',
          background: cfg.stageBg,
          border:`1.5px solid ${cfg.stageBorder}`,
          borderBottom:'none',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:4,
          boxShadow:`inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>
          <div style={{
            fontFamily:'var(--font-mono)', fontSize: rank===1 ? 22 : 16,
            fontWeight:900, color:cfg.xpColor, lineHeight:1,
            textShadow:`0 0 20px ${cfg.xpColor}60`,
          }}>{cfg.label}</div>
          <div style={{ fontSize: rank===1 ? 18 : 14, filter:'drop-shadow(0 0 6px rgba(255,255,255,0.2))' }}>
            {cfg.medal}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Tier divider ─────────────────────────────────────────────
function TierDivider({ label, color, bg }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'16px 0 8px' }}>
      <div style={{ flex:1, height:1, background: color + '40' }} />
      <span style={{
        fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700,
        color, background:bg, padding:'3px 12px', borderRadius:99,
        border:`1px solid ${color}55`, letterSpacing:'0.08em'
      }}>{label}</span>
      <div style={{ flex:1, height:1, background: color + '40' }} />
    </div>
  )
}

export function LeaderboardList({ students, isStudent = false, currentStudentId = null }) {
  const [breakdown, setBreakdown] = useState(null)

  // ── Rank change tracking via sessionStorage ──
  // On first load we store the order; on subsequent renders we diff it
  const sorted = [...students].sort((a, b) => getVerifiedXP(b) - getVerifiedXP(a))
  const SESSION_KEY = 'lb_prev_ranks'
  const prevRanks = (() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
  })()
  // Build current rank map and persist it
  const currentRanks = {}
  sorted.forEach((s, i) => { currentRanks[s.studentId] = i + 1 })
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentRanks)) } catch {}

  function getRankDelta(studentId) {
    if (!prevRanks || !(studentId in prevRanks)) return null
    const prev = prevRanks[studentId]
    const curr = currentRanks[studentId]
    return prev - curr  // positive = moved up (lower rank number = better)
  }

  const top3   = sorted.slice(0, 3)
  const rest   = sorted.slice(3)
  const top5   = rest.slice(0, 2)   // ranks 4–5
  const top10  = rest.slice(2, 7)   // ranks 6–10
  const others = rest.slice(7)      // rank 11+

  // Visual podium order: 2nd left, 1st centre, 3rd right
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3

  function openBreakdown(s) {
    setBreakdown({ ...s, completedTimestamps: s.completedTimestamps || {} })
  }

  function StudentRow({ s, i }) {
    const rank = i + 4
    const vXP = getVerifiedXP(s)
    const { g, c } = getVerifiedGrade(s)
    const completed = s.completedSections || []
    const passD  = SECTIONS.filter(x => x.band === 'pass'        && completed.includes(x.id)).length
    const meritD = SECTIONS.filter(x => x.band === 'merit'       && completed.includes(x.id)).length
    const distD  = SECTIONS.filter(x => x.band === 'distinction' && completed.includes(x.id)).length
    const passT  = SECTIONS.filter(x => x.band === 'pass').length
    const earnedBadges = BADGES.filter(b => (s.badges || []).includes(b.id))
    const verifiedForStatus = Object.entries(s.tutorOverrides || {}).filter(([, v]) => v === true).map(([k]) => k)
    const schedStatus = getScheduleStatus(verifiedForStatus)
    const initial = s.name?.[0] || '?'
    const isMe = s.studentId === currentStudentId
    const group = STUDENT_GROUPS[s.studentId]
    const groupColor = group === 'A' ? '#1D4ED8' : group === 'B' ? '#6D28D9' : group === 'C' ? '#065F46' : 'var(--slate)'
    const groupBg    = group === 'A' ? '#DBEAFE' : group === 'B' ? '#F3E8FF' : group === 'C' ? '#D1FAE5' : 'var(--light)'
    const displayName = isStudent
      ? (isMe ? s.name + ' (you)' : s.name?.split(' ')[0] || 'Student')
      : s.name
    const isTop5 = rank <= 5
    const delta = getRankDelta(s.studentId)

    return (
      <motion.div key={s.studentId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (rank - 4) * 0.03 }}
        onClick={() => openBreakdown(s)}
        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = isMe ? '0 0 0 2px var(--pass)' : 'none'}
        style={{
          background: isMe ? 'var(--pass-light)' : 'var(--white)',
          borderRadius: 10, cursor: 'pointer', transition: 'box-shadow 0.15s',
          border: isMe ? '2px solid var(--pass)' : isTop5 ? '1.5px solid #FCD34D55' : '1.5px solid var(--border)',
          overflow: 'hidden',
          boxShadow: isMe ? '0 0 0 2px var(--pass)' : 'none',
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
          }}>{rank}</div>

          {/* Avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: isMe ? 'var(--pass)' : 'var(--pass-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 900,
            color: isMe ? '#fff' : 'var(--pass)',
          }}>{initial}</div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{displayName}</span>
              {!isStudent && group && (
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
              {!isStudent && <span>{s.studentId} · </span>}
              P {passD}/{passT} · M {meritD}/{SECTIONS.filter(x => x.band === 'merit').length} · D {distD}/{SECTIONS.filter(x => x.band === 'distinction').length}
              {(s.streak || 0) > 1 && <span style={{ marginLeft: 6, color: '#F97316', fontWeight: 700 }}>🔥 {s.streak}d</span>}
            </div>
          </div>

          {/* Right: XP + grade + rank change */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {earnedBadges.length > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)', fontWeight: 700 }}>🏅{earnedBadges.length}</span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{vXP} XP</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: c + '22', color: c, padding: '2px 7px', borderRadius: 4 }}>{g}</span>
            </div>
            {delta !== null && (
              delta === 0
                ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94A3B8' }}>— no change</span>
                : <motion.span
                    initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (rank - 4) * 0.03 }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 2,
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
                      color: delta > 0 ? '#16A34A' : '#DC2626',
                      background: delta > 0 ? '#DCFCE7' : '#FEE2E2',
                      border: `1px solid ${delta > 0 ? '#86EFAC' : '#FCA5A5'}`,
                      borderRadius: 5, padding: '1px 6px',
                    }}>
                    {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                  </motion.span>
            )}
          </div>
        </div>

        {/* Badge row */}
        {earnedBadges.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4,
            padding: '6px 14px 8px', paddingLeft: 68,
            borderTop: '1px solid var(--border)',
            background: isMe ? 'rgba(31,107,58,0.05)' : 'var(--light)',
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
        {breakdown && (
          <XPBreakdownModal
            student={breakdown}
            onClose={() => setBreakdown(null)}
            isStudent={isStudent}
          />
        )}
      </AnimatePresence>

      {/* ── Podium (top 3) ── */}
      {top3.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{
            background: 'linear-gradient(175deg, #0c1525 0%, #111827 50%, #0f172a 100%)',
            borderRadius: 18, padding: '16px 12px 0', marginBottom: 24,
            boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 2px 0 rgba(255,255,255,0.04)',
            overflow: 'hidden', position: 'relative',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
          {/* Spotlight glow behind 1st place */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '60%', height: '80%', pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 10%, rgba(253,211,77,0.1) 0%, transparent 65%)',
          }} />
          {/* Floor line */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(253,211,77,0.3), transparent)',
            pointerEvents: 'none',
          }} />

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: 'rgba(253,211,77,0.55)', textAlign: 'center', letterSpacing: '0.16em',
            marginBottom: 16, textTransform: 'uppercase', position: 'relative' }}>
            🏆 Top of the Class
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, position: 'relative' }}>
            {(top3.length === 3 ? podiumOrder : top3).map(s => (
              <PodiumCard
                key={s.studentId}
                student={s}
                rank={sorted.indexOf(s) + 1}
                isMe={s.studentId === currentStudentId}
                isStudent={isStudent}
                onSelect={openBreakdown}
                rankDelta={getRankDelta(s.studentId)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Ranks 4–5 ── */}
      {top5.length > 0 && (
        <div style={{
          background: 'linear-gradient(180deg, rgba(180,83,9,0.06) 0%, rgba(180,83,9,0.02) 100%)',
          border: '1.5px solid rgba(180,83,9,0.15)',
          borderRadius: 14, padding: '4px 8px 8px', marginBottom: 8,
        }}>
          <TierDivider label="TOP 5" color="#B45309" bg="#FEF3C7" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top5.map((s, i) => <StudentRow key={s.studentId} s={s} i={i} />)}
          </div>
        </div>
      )}

      {/* ── Ranks 6–10 ── */}
      {top10.length > 0 && (
        <div style={{
          background: 'linear-gradient(180deg, rgba(31,107,58,0.06) 0%, rgba(31,107,58,0.02) 100%)',
          border: '1.5px solid rgba(31,107,58,0.15)',
          borderRadius: 14, padding: '4px 8px 8px', marginBottom: 8,
        }}>
          <TierDivider label="TOP 10" color="var(--pass)" bg="var(--pass-light)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {top10.map((s, i) => <StudentRow key={s.studentId} s={s} i={i + 2} />)}
          </div>
        </div>
      )}

      {/* ── Rest ── */}
      {others.length > 0 && (
        <>
          <TierDivider label="THE REST" color="var(--slate)" bg="var(--light)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {others.map((s, i) => <StudentRow key={s.studentId} s={s} i={i + 7} />)}
          </div>
        </>
      )}
    </div>
  )
}