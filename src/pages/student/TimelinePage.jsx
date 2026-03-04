import { motion } from 'framer-motion'
import { WEEKS_DATA, SECTIONS } from '../../data/gameData'

const CRIT_COLORS = {
  P3: { bg: '#d4edda', border: '#74c38a', text: '#155724' },
  P4: { bg: '#b8dfc6', border: '#4daa6a', text: '#0f4a1e' },
  P5: { bg: '#8fcba8', border: '#2d8f52', text: '#fff' },
  P6: { bg: '#5cad7a', border: '#1a6e3c', text: '#fff' },
  P7: { bg: '#2d8f52', border: '#0f4a1e', text: '#fff' },
  M2: { bg: '#fff3cd', border: '#f0c060', text: '#7a5200' },
  M3: { bg: '#ffe8a0', border: '#d4a017', text: '#6b4400' },
  D2: { bg: '#ffe4b5', border: '#c8860a', text: '#5c3800' },
  D3: { bg: '#ffd580', border: '#b06800', text: '#4a2800' },
}

function getWeekStatus(week) {
  const now = new Date()
  const start = new Date(week.start)
  const end   = new Date(week.end + 'T23:59:59')
  if (now > end)   return 'past'
  if (now >= start) return 'current'
  return 'future'
}

export default function TimelinePage({ student }) {
  const completed = student.completedSections || []

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Timeline</h2>
        <p style={{ color: 'var(--slate)', fontSize: 14 }}>Week-by-week breakdown. Stay on track to hit your target grade.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {WEEKS_DATA.map((week, wi) => {
          const status = getWeekStatus(week)
          return (
            <motion.div key={week.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: wi * 0.06 }}
              style={{
                display: 'flex',
                gap: 16,
                opacity: status === 'past' ? 0.7 : 1,
              }}
            >
              {/* Timeline spine */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: status === 'current' ? 'var(--navy)' : status === 'past' ? 'var(--pass)' : 'var(--border)',
                  color: status === 'past' || status === 'current' ? '#fff' : 'var(--slate)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, border: '3px solid var(--white)',
                  boxShadow: status === 'current' ? '0 0 0 3px var(--navy)' : 'var(--shadow)',
                }}>
                  {status === 'past' ? '✓' : wi + 1}
                </div>
                {wi < WEEKS_DATA.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 20,
                    background: status === 'past' ? 'var(--pass-mid)' : 'var(--border)',
                    marginTop: 4 }}/>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 900, color: 'var(--navy)' }}>
                    {week.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>
                    {week.dates}
                  </span>
                  {status === 'current' && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                      background: 'var(--navy)', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                      THIS WEEK
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {week.items.map((item, ii) => {
                    const crit = CRIT_COLORS[item.criteria]
                    return (
                      <div
                        key={ii}
                        style={{
                          background: 'var(--white)',
                          borderRadius: 10,
                          padding: '14px 16px',
                          border: '1.5px solid var(--border)',
                          borderLeft: crit ? `4px solid ${crit.border}` : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                          {crit && (
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                              background: crit.bg, color: crit.text, border: `1.5px solid ${crit.border}`,
                              borderRadius: 4, padding: '2px 8px',
                            }}>{item.criteria}</span>
                          )}
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{item.title}</span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: item.warn || item.subs ? 8 : 0 }}>
                          {item.desc}
                        </p>
                        {item.warn && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)',
                            background: 'var(--red-light)', padding: '5px 10px', borderRadius: 5,
                            marginBottom: 6 }}>{item.warn}</div>
                        )}
                        {item.subs && (
                          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                            {item.subs.map((sub, si) => (
                              <li key={si} style={{ fontSize: 12, color: 'var(--slate)', display: 'flex', gap: 6 }}>
                                <span style={{ color: crit?.border || 'var(--slate)', fontWeight: 700, flexShrink: 0 }}>→</span>
                                {sub}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
