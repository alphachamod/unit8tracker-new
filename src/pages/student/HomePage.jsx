import { motion } from 'framer-motion'
import { SECTIONS, BADGES, TOTAL_XP, PASS_XP, PASS_MERIT_XP, getDaysElapsed, WEEKS_DATA, DEADLINE, START_DATE } from '../../data/gameData'
import Countdown from '../../components/Countdown'

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

const QUICK_NAV = [
  { icon: '📅', label: 'Timeline',        sub: '6-week plan week by week',      page: 'timeline' },
  { icon: '📋', label: 'Sections Guide',  sub: 'Every section in plain English', page: 'sections' },
  { icon: '⚠️', label: 'Integrity Rules', sub: 'What you can and cannot do',     page: 'integrity' },
  { icon: '🔗', label: 'Resources',       sub: 'Useful links and tools',         page: 'resources' },
  { icon: '💬', label: 'FAQ',             sub: 'Common questions answered',      page: 'faq' },
]

const ASSIGNMENT_STEPS = [
  'Find a real small business and understand what they want to achieve',
  'Make a plan for how they should use social media',
  'Get feedback on your plan from the business owner, then improve it',
  'Actually create the social media accounts and post content',
  'Collect data and analyse how well your posts performed',
  "Evaluate everything — what worked, what didn't, and what you'd do differently",
]

export default function HomePage({ student, onNavigate }) {
  const completed = student.completedSections || []
  const overrides = student.tutorOverrides || {}
  const xp = student.xp || 0
  const streak = student.streak || 1
  const badgeIds = student.badges || []

  const passTotal = SECTIONS.filter(s => s.band === 'pass').length
  const passDone  = SECTIONS.filter(s => s.band === 'pass' && completed.includes(s.id)).length

  // What's next: up to 3 sections not done, not rejected, prioritised by schedule week
  const weekSectionOrder = WEEKS_DATA.flatMap(w =>
    SECTIONS.filter(s => w.items.some(i => i.criteria === s.criteria)).map(s => s.id)
  )
  const orderedSections = [
    ...weekSectionOrder.map(id => SECTIONS.find(s => s.id === id)).filter(Boolean),
    ...SECTIONS.filter(s => !weekSectionOrder.includes(s.id))
  ]
  const nextSections = orderedSections
    .filter(s => !completed.includes(s.id) && overrides[s.id] !== false)
    .slice(0, 3)
  const nextSec = nextSections[0] // keep for backward compat

  // Grade projection: extrapolate current XP pace to deadline
  const now = Date.now()
  const elapsedDays = Math.max(1, (now - START_DATE.getTime()) / 86400000)
  const daysLeft    = Math.max(0, (DEADLINE.getTime() - now) / 86400000)
  const dailyRate   = xp / elapsedDays
  const projectedXP = Math.round(xp + dailyRate * daysLeft)
  const projectedGrade = projectedXP >= TOTAL_XP ? 'D*' : projectedXP >= PASS_MERIT_XP ? 'Merit' : projectedXP >= PASS_XP ? 'Pass' : 'Below Pass'
  const projectedColor = projectedXP >= TOTAL_XP ? 'var(--dist)' : projectedXP >= PASS_MERIT_XP ? 'var(--merit)' : projectedXP >= PASS_XP ? 'var(--pass)' : 'var(--red)'

  const recentBadges = BADGES.filter(b => badgeIds.includes(b.id)).slice(-3)
  const tutorNote    = student.tutorNote

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'linear-gradient(135deg, #1a2035, #2E4057)', borderRadius: 16,
          padding: '32px 28px 30px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          background: 'rgba(255,255,255,0.03)', borderRadius: '50%', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: -60, right: 60, width: 140, height: 140,
          background: 'rgba(31,107,58,0.15)', borderRadius: '50%', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', right: 24, top: 22 }}>
          <Countdown />
        </div>
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            background: 'rgba(15,23,42,0.9)', color: '#fff', padding: '4px 10px',
            borderRadius: 999, border: '1px solid rgba(148,163,184,0.6)' }}>
            Unit 8 · Assignment 02
          </span>
          {streak >= 2 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
              background: 'rgba(245,158,11,0.25)', color: '#FCD34D', padding: '4px 10px',
              borderRadius: 999, border: '1px solid rgba(245,158,11,0.7)' }}>
              🔥 {streak} day streak
            </span>
          )}
        </div>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 900, marginBottom: 4, lineHeight: 1.2 }}>
          Hi {student.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
          Social Media in Business · Week-by-week guide to Assignment 02.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(248,113,113,0.18)', border: '1px solid rgba(248,113,113,0.4)',
          borderRadius: 8, padding: '7px 12px',
          fontSize: 12, color: '#FCA5A5', fontWeight: 600, maxWidth: 520 }}>
          ⚠️ If you miss the deadline or your work is rejected, your next submission is capped at a Pass — no exceptions.
        </div>
        {/* Date strip */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, padding: '5px 12px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Start</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
              05 March 2026
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 6, padding: '5px 12px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deadline</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
              15 April 2026 · 5:00pm
            </span>
          </div>
        </div>
        <div style={{ background: 'rgba(15,23,42,0.45)', borderRadius: 12,
          padding: '14px 16px 12px', border: '1px solid rgba(148,163,184,0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#FCD34D' }}>
              {xp} XP
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(226,232,240,0.9)' }}>
              {passDone}/{passTotal} pass sections completed
            </span>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (xp / TOTAL_XP) * 100)}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', borderRadius: 999,
                  background: xp >= TOTAL_XP ? 'var(--dist-mid)' : xp >= PASS_MERIT_XP ? 'var(--merit-mid)' : '#4ade80' }}/>
            </div>
            {[{ label: 'P', value: PASS_XP }, { label: 'M', value: PASS_MERIT_XP }, { label: 'D', value: TOTAL_XP }].map(m => (
              <div key={m.label} style={{ position: 'absolute', left: `${Math.min(100,(m.value/TOTAL_XP)*100)}%`,
                top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', pointerEvents: 'none' }}>
                <div style={{ width: 1, height: 9, background: 'rgba(248,250,252,0.9)', marginTop: -2 }}/>
                <span style={{ marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(226,232,240,0.95)' }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', height: 16 }}>
            {[
              { label: 'Pass', value: PASS_XP },
              { label: 'Merit', value: PASS_MERIT_XP },
              { label: 'Distinction', value: TOTAL_XP },
            ].map(m => (
              <span key={m.label} style={{
                position: 'absolute',
                left: `${Math.min(100, (m.value / TOTAL_XP) * 100)}%`,
                transform: m.value === TOTAL_XP ? 'translateX(-100%)' : m.value === PASS_XP ? 'translateX(0%)' : 'translateX(-50%)',
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(226,232,240,0.8)',
                whiteSpace: 'nowrap',
              }}>{m.label}</span>
            ))}
          </div>
          {/* Grade projection */}
          {daysLeft > 0 && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px',
              border: '1px solid rgba(255,255,255,0.12)' }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>At your current pace you're on track for </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900, color: projectedColor }}>
                  {projectedGrade}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}> by the deadline</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                ~{projectedXP} XP proj.
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tutor note */}
      {tutorNote && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ background: '#fffbeb', border: '1.5px solid var(--merit-mid)', borderRadius: 12,
            padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>📝</span>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: 'var(--merit)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Note from Mr Ravindu
            </div>
            <p style={{ fontSize: 14, color: 'var(--navy)', lineHeight: 1.6 }}>{tutorNote}</p>
          </div>
        </motion.div>
      )}

      {/* Rejections banner */}
      {Object.entries(overrides).some(([, v]) => v === false) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ background: 'var(--red-light)', border: '1.5px solid #FCA5A5', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            ⚠️ Sections requiring attention
          </div>
          {Object.entries(overrides).filter(([, v]) => v === false).map(([sid]) => {
            const sec = SECTIONS.find(s => s.id === sid)
            return sec ? (
              <div key={sid} style={{ fontSize: 13, color: 'var(--red)', marginBottom: 3 }}>
                ✗ {sec.title} — resubmit on Canvas
              </div>
            ) : null
          })}
        </motion.div>
      )}

      {/* Grid: next up / badges / progress */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        {nextSections.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            onClick={() => onNavigate('sections')}
            style={{ background: 'var(--white)', borderRadius: 12, padding: 20,
              border: '1.5px solid var(--pass-mid)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              🎯 What to work on next
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {nextSections.map((sec, i) => {
                const c = CRIT_COLORS[sec.criteria]
                return (
                  <div key={sec.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: i === 0 ? 'var(--pass-light)' : 'var(--light)',
                    borderRadius: 8, padding: '9px 12px',
                    border: `1.5px solid ${i === 0 ? 'var(--pass-mid)' : 'var(--border)'}`,
                    opacity: i === 0 ? 1 : 0.75,
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: i === 0 ? 'var(--pass)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                      color: i === 0 ? '#fff' : 'var(--slate)' }}>
                      {i + 1}
                    </div>
                    {c && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                        background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                        borderRadius: 3, padding: '1px 6px', flexShrink: 0 }}>
                        {sec.criteria}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: 'var(--navy)', lineHeight: 1.3 }}>
                      {sec.title}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                      color: i === 0 ? 'var(--pass)' : 'var(--slate)', flexShrink: 0 }}>
                      +{sec.xp}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--pass)', fontWeight: 700 }}>
              View all sections →
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ background: 'var(--white)', borderRadius: 12, padding: 20, border: '1.5px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Badges earned
          </div>
          {recentBadges.length === 0
            ? <p style={{ fontSize: 13, color: 'var(--slate)' }}>Complete your first section to earn a badge.</p>
            : recentBadges.map(b => (
                <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{b.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)', fontWeight: 700 }}>
                      +{b.xpBonus} XP
                    </div>
                  </div>
                </div>
              ))
          }
          {badgeIds.length > 3 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)', marginTop: 4 }}>
              +{badgeIds.length - 3} more
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ background: 'var(--white)', borderRadius: 12, padding: 20, border: '1.5px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Progress
          </div>
          {[
            { label: 'Pass', secs: SECTIONS.filter(s => s.band === 'pass'), color: 'var(--pass)' },
            { label: 'Merit', secs: SECTIONS.filter(s => s.band === 'merit'), color: 'var(--merit)' },
            { label: 'Distinction', secs: SECTIONS.filter(s => s.band === 'distinction'), color: 'var(--dist)' },
          ].map(({ label, secs, color }) => {
            const done = secs.filter(s => completed.includes(s.id)).length
            return (
              <div key={label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>
                    {done}/{secs.length}
                  </span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(done / secs.length) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                    style={{ height: '100%', background: color, borderRadius: 4 }}/>
                </div>
              </div>
            )
          })}
        </motion.div>
      </div>

      {/* Quick nav cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {QUICK_NAV.map((item, i) => (
          <motion.div key={item.page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => onNavigate(item.page)}
            style={{ background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 12,
              padding: 16, cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--navy)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 11, color: 'var(--slate)', lineHeight: 1.4 }}>{item.sub}</div>
          </motion.div>
        ))}
      </div>


      {/* Assignment explainer */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        style={{ background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '24px 28px' }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 900, color: 'var(--navy)', marginBottom: 10 }}>
          What is this assignment actually asking you to do?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.7, marginBottom: 16 }}>
          You work for a local chamber of commerce. A small business owner has come to you and asked you
          to help them get started on social media. Your job is to:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ASSIGNMENT_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--light)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>
                {i + 1}
              </div>
              <span style={{ fontSize: 14, color: 'var(--navy)', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>
      </motion.div>


    </div>
  )
}