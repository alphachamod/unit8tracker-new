import { useState, useEffect } from 'react'
import { DEADLINE } from '../data/gameData'

function calc() {
  const diff = DEADLINE - Date.now()
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { d, h, m, s }
}

export default function Countdown() {
  const [timeLeft, setTimeLeft] = useState(() => calc())

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(calc()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!timeLeft) return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
      color: '#FCA5A5', letterSpacing: '0.06em' }}>
      ⚠️ DEADLINE PASSED
    </div>
  )

  const urgent = timeLeft.d < 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: urgent ? '#FCA5A5' : '#FCD34D' }}>
        Time left to submit
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { v: timeLeft.d, label: 'Days' },
          { v: timeLeft.h, label: 'Hours' },
          { v: timeLeft.m, label: 'Minutes' },
          { v: timeLeft.s, label: 'Seconds' },
        ].map(({ v, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
              color: urgent ? '#FCA5A5' : '#fff',
              background: 'rgba(255,255,255,0.1)',
              border: `1.5px solid ${urgent ? 'rgba(252,165,165,0.4)' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 8, padding: '6px 10px', minWidth: 44,
              display: 'block', lineHeight: 1,
            }}>
              {String(v).padStart(2, '0')}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}