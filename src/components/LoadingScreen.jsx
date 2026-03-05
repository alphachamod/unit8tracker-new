import { motion } from 'framer-motion'

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'linear-gradient(135deg, #1a2035, #2E4057)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
      >
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          background: 'rgba(255,255,255,0.12)', color: '#fff',
          padding: '4px 12px', borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.15)',
          letterSpacing: '0.08em',
        }}>Unit 8</span>
        <span style={{
          fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 900, color: '#fff',
        }}>Social Media in Business</span>
      </motion.div>

      {/* Spinner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
      >
        <div style={{ position: 'relative', width: 40, height: 40 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.1)',
              borderTop: '3px solid #4ade80',
              position: 'absolute', inset: 0,
            }}
          />
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em',
        }}>{message}</span>
      </motion.div>
    </motion.div>
  )
}
