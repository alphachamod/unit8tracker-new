import { useEffect } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { SECTION_POPUPS } from '../data/gameData'

export default function SectionPopup({ sectionId, xp, onClose }) {
  const popup = SECTION_POPUPS[sectionId]

  useEffect(() => {
    const fire = (origin, angle) => confetti({
      particleCount: 60, spread: 55, angle, origin,
      colors: ['#22c55e', '#FCD34D', '#60a5fa', '#f472b6', '#a78bfa'],
      zIndex: 2100,
    })
    const t = setTimeout(() => {
      fire({ x: 0.2, y: 0.65 }, 60)
      fire({ x: 0.8, y: 0.65 }, 120)
    }, 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(10,15,30,0.55)',
        backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.78, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 340, damping: 22 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--white)', borderRadius: 20, padding: '40px 36px',
          maxWidth: 440, width: '100%', textAlign: 'center',
          boxShadow: '0 28px 64px rgba(0,0,0,0.28)' }}>
        <motion.div
          animate={{ rotate: [0, -10, 10, -8, 8, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.55, delay: 0.1 }}
          style={{ fontSize: 56, marginBottom: 12 }}>
          {popup?.emoji || '✅'}
        </motion.div>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.2 }}
          style={{ display: 'inline-block', background: 'var(--gold)', color: '#fff',
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900,
            padding: '5px 16px', borderRadius: 20, marginBottom: 16 }}>
          +{xp} XP earned
        </motion.div>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 900,
          color: 'var(--navy)', marginBottom: 6 }}>
          {popup?.title || 'Section complete!'}
        </h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', color: 'var(--pass)', textTransform: 'uppercase', marginBottom: 10 }}>
          — Mr Ravindu
        </p>
        <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.75, marginBottom: 28 }}>
          {popup?.msg || 'Keep going — every section brings you closer to your final grade.'}
        </p>
        <button onClick={onClose}
          style={{ background: 'var(--navy)', color: '#fff', padding: '12px 32px',
            borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Keep Going →
        </button>
      </motion.div>
    </motion.div>
  )
}