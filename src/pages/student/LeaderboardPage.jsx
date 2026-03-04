import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getAllStudents } from '../../lib/firebase'
import { TOTAL_XP, PASS_XP, PASS_MERIT_XP } from '../../data/gameData'

export default function LeaderboardPage({ student }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllStudents().then(all => {
      const sorted = all
        .map(s => ({ studentId: s.studentId, name: s.name, xp: s.xp || 0, badges: (s.badges || []).length }))
        .sort((a, b) => b.xp - a.xp)
      setStudents(sorted)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function gradeLabel(xp) {
    if (xp >= TOTAL_XP) return { label: 'D', color: 'var(--dist)' }
    if (xp >= PASS_MERIT_XP) return { label: 'M', color: 'var(--merit)' }
    if (xp >= PASS_XP) return { label: 'P', color: 'var(--pass)' }
    return { label: '—', color: 'var(--slate)' }
  }

  const myRank = students.findIndex(s => s.studentId === student.studentId) + 1

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Leaderboard</h2>
        <p style={{ color: 'var(--slate)', fontSize: 14 }}>Your rank is shown. Exact XP of other students is hidden.</p>
      </div>

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {students.map((s, i) => {
            const isMe = s.studentId === student.studentId
            const { label, color } = gradeLabel(s.xp)
            const firstName = s.name?.split(' ')[0] || '—'
            const initial   = s.name?.[0] || '?'

            return (
              <motion.div key={s.studentId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10,
                  background: isMe ? 'var(--navy)' : i < 3 ? 'var(--white)' : 'var(--white)',
                  border: `1.5px solid ${isMe ? 'var(--navy)' : i === 0 ? '#FCD34D' : i === 1 ? '#CBD5E1' : i === 2 ? '#D97706' : 'var(--border)'}`,
                  color: isMe ? '#fff' : 'var(--navy)',
                }}>
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
                }}>
                  {initial}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isMe ? s.name + ' (you)' : firstName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: isMe ? 'rgba(255,255,255,0.6)' : 'var(--slate)' }}>
                    {s.badges} badge{s.badges !== 1 ? 's' : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    background: isMe ? 'rgba(255,255,255,0.15)' : color + '22',
                    color: isMe ? '#FCD34D' : color,
                    padding: '2px 8px', borderRadius: 4,
                  }}>{label}</span>
                  {isMe && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#FCD34D' }}>
                      {s.xp} XP
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
