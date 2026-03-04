import { motion } from 'framer-motion'
import { TOTAL_XP, PASS_XP, PASS_MERIT_XP } from '../data/gameData'

export default function XPBar({ xp }) {
  const pct = Math.min(100, (xp / TOTAL_XP) * 100)
  const grade = xp >= TOTAL_XP ? 'D' : xp >= PASS_MERIT_XP ? 'M' : xp >= PASS_XP ? 'P' : null

  const color = grade === 'D' ? 'var(--dist)'
    : grade === 'M' ? 'var(--merit)'
    : 'var(--pass)'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color }}>
          {xp} / {TOTAL_XP} XP
        </span>
        {grade && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            background: color, color: '#fff',
            padding: '2px 10px', borderRadius: 20,
          }}>
            On track for {grade === 'D' ? 'Distinction' : grade === 'M' ? 'Merit' : 'Pass'}
          </span>
        )}
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: color, borderRadius: 8 }}
        />
      </div>
      {/* Grade milestones */}
      <div style={{ position: 'relative', marginTop: 4, height: 16 }}>
        {[
          { label: 'P', xp: PASS_XP },
          { label: 'M', xp: PASS_MERIT_XP },
          { label: 'D', xp: TOTAL_XP },
        ].map(m => (
          <div key={m.label} style={{
            position: 'absolute', left: `${(m.xp / TOTAL_XP) * 100}%`,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ width: 1, height: 4, background: 'var(--border)' }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              color: xp >= m.xp ? color : 'var(--slate)',
            }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
