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

  if (!timeLeft) {
    return (
      <div
        style={{
          padding: '6px 10px',
          borderRadius: 999,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          background: 'var(--red-light)',
          color: 'var(--red)',
          border: '1px solid #FCA5A5',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '999px', background: 'var(--red)' }} />
        The deadline for this unit has passed
      </div>
    )
  }

  const urgent = timeLeft.d < 3
  const close = !urgent && timeLeft.d < 7

  const palette = urgent
    ? {
        toneColor: 'var(--red)',
        toneBg: 'var(--red-light)',
        toneBorder: '#FCA5A5',
      }
    : close
    ? {
        toneColor: '#B45309',
        toneBg: '#FEF3C7',
        toneBorder: '#FBBF24',
      }
    : {
        toneColor: '#047857',
        toneBg: '#ECFDF5',
        toneBorder: '#6EE7B7',
      }

  return (
    <div
      aria-label="Time left until deadline"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.08,
          color: palette.toneColor,
        }}
      >
        {urgent
          ? 'Almost there – please submit soon'
          : close
          ? 'About one week left'
          : 'Time left to submit'}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[
          { v: timeLeft.d, label: 'Days' },
          { v: timeLeft.h, label: 'Hours' },
          { v: timeLeft.m, label: 'Minutes' },
          { v: timeLeft.s, label: 'Seconds' },
        ].map(({ v, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 20,
                fontWeight: 700,
                color: palette.toneColor,
                background: palette.toneBg,
                border: `1.5px solid ${palette.toneBorder}`,
                borderRadius: 6,
                padding: '4px 8px',
                minWidth: 36,
                display: 'block',
              }}
            >
              {String(v).padStart(2, '0')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--slate)',
                marginTop: 2,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
