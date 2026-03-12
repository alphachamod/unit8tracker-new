import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BADGES, getDaysElapsed } from '../../data/gameData'

const CATEGORIES = [
  { id: 'all',        label: 'All',        emoji: '🎯' },
  { id: 'progress',   label: 'Progress',   emoji: '📈' },
  { id: 'speed',      label: 'Speed',      emoji: '⚡' },
  { id: 'streak',     label: 'Streaks',    emoji: '🔥' },
  { id: 'milestone',  label: 'Milestones', emoji: '🏅' },
  { id: 'quality',    label: 'Quality',    emoji: '🛡️' },
]

const BADGE_CATEGORIES = {
  first_section:  'progress',
  half_pass:      'progress',
  plan_approved:  'progress',
  reviewed:       'progress',
  published:      'progress',
  analyst:        'progress',
  seo_done:       'progress',
  pass_complete:  'progress',
  merit_hunter:   'progress',
  merit_done:     'progress',
  d2_done:        'progress',
  distinction:    'progress',
  early_plan:     'speed',
  early_pass:     'speed',
  early_merit:    'speed',
  early_dist:     'speed',
  streak_3:       'streak',
  streak_7:       'streak',
  streak_14:      'streak',
  milestone_120:  'milestone',
  milestone_200:  'milestone',
  milestone_300:  'milestone',
  milestone_500:  'milestone',
  all_verified:   'quality',
  no_rejected:    'quality',
}

export default function BadgesPage({ student }) {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const completedSections = student.completedSections || []
  const earnedIds = student.badges || []
  const tutorOverrides = student.tutorOverrides || {}
  const milestoneBonus = student.milestoneBonus || 0
  const streak = student.streak || 0
  const days = getDaysElapsed()

  // Compute which badges are actually earned (re-evaluate conditions)
  const badgeStatus = BADGES.map(b => {
    const earned = earnedIds.includes(b.id) ||
      (b.condition ? b.condition(completedSections, 0, streak, days, tutorOverrides, milestoneBonus) : false)
    return { ...b, earned, category: BADGE_CATEGORIES[b.id] || 'progress' }
  })

  const earnedBadges  = badgeStatus.filter(b => b.earned)
  const lockedBadges  = badgeStatus.filter(b => !b.earned)
  const totalXPFromBadges = earnedBadges.reduce((a, b) => a + (b.xpBonus || 0), 0)

  const filtered = filter === 'all'
    ? badgeStatus
    : badgeStatus.filter(b => b.category === filter)

  const filteredEarned = filtered.filter(b => b.earned)
  const filteredLocked = filtered.filter(b => !b.earned)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* Header */}
      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
        style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily:'var(--font-head)', fontSize: 28, fontWeight: 700,
          color:'var(--navy)', margin:0 }}>
          Your Badges
        </h1>
        <p style={{ color:'var(--slate)', fontSize:14, margin:'4px 0 0' }}>
          {earnedBadges.length} of {BADGES.length} earned
          {totalXPFromBadges > 0 && <span style={{ color:'var(--pass)', fontWeight:600 }}> · +{totalXPFromBadges} XP from badges</span>}
        </p>
      </motion.div>

      {/* Progress bar */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }}
        style={{ background:'var(--border)', borderRadius:99, height:8, marginBottom:24, overflow:'hidden' }}>
        <motion.div
          initial={{ width:0 }}
          animate={{ width:`${(earnedBadges.length / BADGES.length) * 100}%` }}
          transition={{ duration:0.8, ease:'easeOut', delay:0.2 }}
          style={{ height:'100%', background:'linear-gradient(90deg, var(--pass), #2ecc71)', borderRadius:99 }}
        />
      </motion.div>

      {/* Category filter */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
        {CATEGORIES.map(cat => {
          const count = cat.id === 'all'
            ? earnedBadges.length
            : earnedBadges.filter(b => b.category === cat.id).length
          const isActive = filter === cat.id
          return (
            <button key={cat.id} onClick={() => setFilter(cat.id)}
              style={{
                padding:'6px 14px', borderRadius:99, fontSize:13, fontWeight:600,
                border: isActive ? 'none' : '1.5px solid var(--border)',
                background: isActive ? 'var(--navy)' : 'var(--white)',
                color: isActive ? '#fff' : 'var(--slate)',
                cursor:'pointer', transition:'all 0.15s',
                display:'flex', alignItems:'center', gap:5
              }}>
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              {count > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--pass-light)',
                  color: isActive ? '#fff' : 'var(--pass)',
                  borderRadius:99, fontSize:11, padding:'1px 6px', fontWeight:700
                }}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Earned section */}
      {filteredEarned.length > 0 && (
        <section style={{ marginBottom:32 }}>
          <h2 style={{ fontSize:13, fontWeight:700, color:'var(--pass)', textTransform:'uppercase',
            letterSpacing:'0.08em', margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
            <span>✅</span> Earned ({filteredEarned.length})
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:12 }}>
            {filteredEarned.map((b, i) => (
              <BadgeCard key={b.id} badge={b} earned index={i}
                onClick={() => setSelected(selected?.id === b.id ? null : b)} />
            ))}
          </div>
        </section>
      )}

      {/* Locked section */}
      {filteredLocked.length > 0 && (
        <section>
          <h2 style={{ fontSize:13, fontWeight:700, color:'var(--slate)', textTransform:'uppercase',
            letterSpacing:'0.08em', margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
            <span>🔒</span> Not Yet Unlocked ({filteredLocked.length})
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:12 }}>
            {filteredLocked.map((b, i) => (
              <BadgeCard key={b.id} badge={b} earned={false} index={i}
                onClick={() => setSelected(selected?.id === b.id ? null : b)} />
            ))}
          </div>
        </section>
      )}

      {/* Detail popover */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity:0, y:16, scale:0.97 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:10, scale:0.97 }}
            transition={{ duration:0.2 }}
            style={{
              position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
              width:'calc(100% - 32px)', maxWidth:400,
              background:'var(--white)', borderRadius:16, padding:20,
              boxShadow:'0 12px 40px rgba(0,0,0,0.15)',
              border:`2px solid ${selected.earned ? 'var(--pass-mid)' : 'var(--border)'}`,
              zIndex:200
            }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{
                fontSize:40, width:60, height:60, borderRadius:14, display:'flex',
                alignItems:'center', justifyContent:'center', flexShrink:0,
                background: selected.earned ? 'var(--pass-light)' : '#f0f0f0',
                filter: selected.earned ? 'none' : 'grayscale(1) opacity(0.5)'
              }}>{selected.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:17, color:'var(--navy)',
                  fontFamily:'var(--font-head)' }}>{selected.name}</div>
                <div style={{ fontSize:14, color:'var(--slate)', marginTop:4, lineHeight:1.5 }}>
                  {selected.desc}
                </div>
                <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
                  {selected.xpBonus > 0 && (
                    <span style={{ background:'var(--pass-light)', color:'var(--pass)',
                      fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:99 }}>
                      +{selected.xpBonus} XP
                    </span>
                  )}
                  {selected.isMilestone && (
                    <span style={{ background:'#FFF8E7', color:'var(--merit)',
                      fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:99 }}>
                      🏅 Milestone Bonus
                    </span>
                  )}
                  <span style={{
                    fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:99,
                    background: selected.earned ? 'var(--pass-light)' : 'var(--red-light)',
                    color: selected.earned ? 'var(--pass)' : 'var(--red)'
                  }}>
                    {selected.earned ? '✓ Earned' : '🔒 Locked'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ fontSize:18, color:'var(--slate)', lineHeight:1, padding:4 }}>✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

function BadgeCard({ badge, earned, index, onClick }) {
  return (
    <motion.button
      initial={{ opacity:0, scale:0.9 }}
      animate={{ opacity:1, scale:1 }}
      transition={{ delay: index * 0.04, duration:0.2 }}
      whileHover={{ scale:1.03, transition:{ duration:0.1 } }}
      whileTap={{ scale:0.97 }}
      onClick={onClick}
      style={{
        background: earned ? 'var(--white)' : '#f8f8f8',
        border: earned ? '1.5px solid var(--pass-mid)' : '1.5px solid var(--border)',
        borderRadius:14, padding:'16px 12px', textAlign:'center',
        cursor:'pointer', position:'relative', overflow:'hidden',
        transition:'box-shadow 0.15s',
        boxShadow: earned ? 'var(--shadow)' : 'none',
      }}>
      {/* Shine effect for earned */}
      {earned && (
        <div style={{
          position:'absolute', top:0, left:'-100%', width:'60%', height:'100%',
          background:'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)',
          pointerEvents:'none'
        }} />
      )}
      <div style={{
        fontSize:32, marginBottom:8,
        filter: earned ? 'none' : 'grayscale(1) opacity(0.35)',
        transition:'filter 0.2s'
      }}>
        {badge.icon}
      </div>
      <div style={{
        fontSize:12, fontWeight:700, lineHeight:1.3,
        color: earned ? 'var(--navy)' : 'var(--slate)',
        opacity: earned ? 1 : 0.6
      }}>
        {badge.name}
      </div>
      {badge.xpBonus > 0 && earned && (
        <div style={{ fontSize:11, color:'var(--pass)', fontWeight:600, marginTop:4 }}>
          +{badge.xpBonus} XP
        </div>
      )}
      {!earned && (
        <div style={{ fontSize:10, color:'#bbb', marginTop:4 }}>🔒 Locked</div>
      )}
    </motion.button>
  )
}
