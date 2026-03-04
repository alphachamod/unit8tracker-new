import { motion } from 'framer-motion'

export default function Toast({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 20, x: '-50%' }}
      style={{
        position: 'fixed', bottom: 28, left: '50%',
        background: 'var(--navy)', color: '#fff',
        padding: '11px 22px', borderRadius: 40,
        fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        zIndex: 9999, whiteSpace: 'nowrap', maxWidth: '90vw',
        textOverflow: 'ellipsis', overflow: 'hidden',
      }}
    >
      {message}
    </motion.div>
  )
}
