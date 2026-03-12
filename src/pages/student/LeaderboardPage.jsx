import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { listenToAllStudents } from '../../lib/firebase'
import { LeaderboardList } from '../../lib/leaderboardShared'

export default function LeaderboardPage({ student }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const unsub = listenToAllStudents(all => {
      setStudents(all.map(s => ({
        studentId:           s.studentId,
        name:                s.name,
        xp:                  s.xp || 0,
        badges:              s.badges || [],
        completedSections:   s.completedSections || [],
        tutorOverrides:      s.tutorOverrides || {},
        earlyBonuses:        s.earlyBonuses || {},
        verifyTimestamps:    s.verifyTimestamps || {},
        completedTimestamps: s.completedTimestamps || {},
        milestoneBonus:      s.milestoneBonus || 0,
        streak:              s.streak || 0,
      })))
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 80px' }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 700,
          color: 'var(--navy)', margin: 0 }}>
          🏆 Leaderboard
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: 14, margin: '4px 0 0' }}>
          Tap any student to see their XP breakdown
        </p>
      </motion.div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--slate)', padding: 60 }}>Loading...</div>
      ) : (
        <LeaderboardList
          students={students}
          isStudent={true}
          currentStudentId={student?.studentId}
        />
      )}
    </div>
  )
}