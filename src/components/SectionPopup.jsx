import { motion } from 'framer-motion'
import { SECTION_POPUPS } from '../data/gameData'

export default function SectionPopup({ sectionId, xp, onClose }) {
  const popup = SECTION_POPUPS[sectionId]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(10,15,30,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white)', borderRadius: 20, padding: '40px 36px',
          maxWidth: 440, width: '100%', textAlign: 'center',
          boxShadow: '0 28px 64px rgba(0,0,0,0.28)',
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 12 }}>{popup?.emoji || '✅'}</div>

        <div style={{
          display: 'inline-block', background: 'var(--gold)', color: '#fff',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          padding: '4px 14px', borderRadius: 20, marginBottom: 16,
        }}>
          +{xp} XP earned
        </div>

        <h2 style={{
          fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 900,
          color: 'var(--navy)', marginBottom: 6,
        }}>
          {popup?.title || 'Section complete!'}
        </h2>

        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', color: 'var(--pass)',
          textTransform: 'uppercase', marginBottom: 10,
        }}>
          — Mr Ravindu
        </p>

        <p style={{ fontSize: 14, color: 'var(--slate)', lineHeight: 1.75, marginBottom: 28 }}>
          {popup?.msg || 'Keep going — every section brings you closer to your final grade.'}
        </p>

        <button
          onClick={onClose}
          style={{
            background: 'var(--navy)', color: '#fff',
            padding: '12px 32px', borderRadius: 8,
            fontSize: 14, fontWeight: 700,
          }}
        >
          Keep Going →
        </button>
      </motion.div>
    </motion.div>
  )
}
