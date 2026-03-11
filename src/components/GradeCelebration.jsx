import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'

const GRADE_CONFIG = {
  P: {
    label: 'PASS',
    emoji: '🎓',
    color: 'var(--pass)',
    bg: 'linear-gradient(135deg, #064e3b, #065f46, #047857)',
    message: "You've secured a Pass grade. Your hard work is paying off — now push for Merit!",
    sub: 'All pass sections verified ✓',
    sounds: [261.63, 329.63, 392.00, 523.25], // C4 E4 G4 C5 — major chord arp
  },
  M: {
    label: 'MERIT',
    emoji: '🌟',
    color: '#FCD34D',
    bg: 'linear-gradient(135deg, #713f12, #92400e, #b45309)',
    message: "Outstanding — you've hit Merit! Keep pushing, Distinction is within reach.",
    sub: 'Merit sections verified ✓',
    sounds: [329.63, 415.30, 493.88, 659.25], // E4 G#4 B4 E5 — E major arp
  },
  D: {
    label: 'DISTINCTION',
    emoji: '👑',
    color: '#FCD34D',
    bg: 'linear-gradient(135deg, #1e1b4b, #312e81, #4338ca)',
    message: "DISTINCTION! This is the highest grade possible. You should be incredibly proud!",
    sub: 'Full Distinction verified ✓',
    sounds: [523.25, 659.25, 783.99, 1046.50], // C5 E5 G5 C6 — high major arp
  },
}

function playFanfare(notes) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.13
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.35, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55)
      osc.start(start)
      osc.stop(start + 0.6)
    })
    // Extra chord hit at the end
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'triangle'
      osc.frequency.value = freq
      const start = ctx.currentTime + notes.length * 0.13 + 0.1
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.2, start + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2)
      osc.start(start)
      osc.stop(start + 1.3)
    })
  } catch (e) {
    // AudioContext not available — silent fallback
  }
}

export default function GradeCelebration({ grade, onClose }) {
  const config = GRADE_CONFIG[grade]
  const fired  = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    // Sound
    playFanfare(config.sounds)

    // Massive confetti cannon
    const colors = grade === 'D'
      ? ['#FCD34D', '#a78bfa', '#60a5fa', '#fff', '#f9a8d4']
      : grade === 'M'
      ? ['#FCD34D', '#fb923c', '#fbbf24', '#fff', '#4ade80']
      : ['#4ade80', '#22c55e', '#FCD34D', '#fff', '#86efac']

    // Initial burst from centre
    confetti({ particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.4 }, colors, zIndex: 3100 })

    // Side cannons with delay
    setTimeout(() => {
      confetti({ particleCount: 80, angle: 60,  spread: 70, origin: { x: 0, y: 0.6 }, colors, zIndex: 3100 })
      confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors, zIndex: 3100 })
    }, 300)

    // Sustained shower for 3s
    let count = 0
    const interval = setInterval(() => {
      confetti({
        particleCount: 18,
        spread: 90,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
        colors,
        zIndex: 3100,
        gravity: 0.8,
      })
      if (++count > 15) clearInterval(interval)
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: config.bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 32, textAlign: 'center' }}>

      {/* Stars bg */}
      {[...Array(12)].map((_, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.5 + Math.random(), repeat: Infinity, delay: Math.random() * 2 }}
          style={{ position: 'absolute',
            left: `${Math.random() * 90 + 5}%`,
            top:  `${Math.random() * 80 + 5}%`,
            fontSize: 14 + Math.random() * 10,
            pointerEvents: 'none', userSelect: 'none' }}>
          ✦
        </motion.div>
      ))}

      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
        style={{ fontSize: 96, marginBottom: 12, filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.4))' }}>
        {config.emoji}
      </motion.div>

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
          color: 'rgba(255,255,255,0.7)', letterSpacing: '0.25em',
          textTransform: 'uppercase', marginBottom: 8 }}>
          You've achieved
        </div>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: grade === 'D' ? 72 : 64,
          fontWeight: 900, color: config.color, lineHeight: 1,
          textShadow: '0 0 40px rgba(255,255,255,0.3)', marginBottom: 8 }}>
          {config.label}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
          color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
          {config.sub}
        </div>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7,
          maxWidth: 480, margin: '0 auto 36px' }}>
          {config.message}
        </p>
        <motion.button onClick={onClose} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '2px solid rgba(255,255,255,0.4)',
            padding: '14px 40px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            backdropFilter: 'blur(8px)' }}>
          {grade === 'D' ? '👑 Amazing — Close' : '🚀 Keep pushing — Close'}
        </motion.button>
        <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'rgba(255,255,255,0.35)' }}>
          tap anywhere to dismiss
        </div>
      </motion.div>
    </motion.div>
  )
}
