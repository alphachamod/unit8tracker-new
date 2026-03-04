import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SECTIONS } from '../../data/gameData'

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

const SECTION_DETAILS = {
  s1:  { subs: ['Business name, type, and what it sells', 'Who runs it and your contact with them', 'Why you chose this business', 'Current online/social media presence', 'Business aims and how social media will help'] },
  s2a: { subs: ['Choose exactly 3 platforms', 'Justify each choice — who uses it and why it fits this business', 'Explain why you rejected other platforms'] },
  s2b: { subs: ['Age range, gender split, location', 'Interests, behaviours, buying habits', 'How this audience uses social media'] },
  s2c: { subs: ['5 researched keywords minimum', 'Use Google Keyword Planner or similar', 'Include search volume for each keyword'] },
  s2d: { subs: ['Best posting times for each platform', 'Based on YOUR target audience — not generic advice', 'Include sources/evidence for your times'] },
  s2e: { subs: ['Minimum 6 posts planned', 'Include: date, platform, content type, caption, hashtags', 'At least 3 different content formats'] },
  s2f: { subs: ['GDPR — how you will handle follower data', 'Copyright — images, music, content you use', 'Advertising standards — how to stay compliant', 'What you will do (not just definitions)'] },
  s2g: { subs: ['Who is responsible for each platform', 'What language/tone to use', 'What content is and is not allowed', 'How to handle negative comments', 'Response time expectations'] },
  s3a: { subs: ['Meeting notes, email thread, or completed Google Form', 'Must be with the actual business owner (not a friend)', 'Date and method of contact clearly stated', 'Must happen BEFORE you start posting'] },
  s3b: { subs: ['Specific feedback points listed', 'At least 3 pieces of feedback', 'Both positive and constructive feedback'] },
  s3c: { subs: ['Updated schedule with all changes applied', '"What changed" column explaining every modification', '"Why" column linking each change to the feedback received'] },
  s4:  { subs: ['Screenshot of every profile on every platform', 'Annotate: username choice, bio text, profile image', 'Explain why each design choice was made', 'Use consistent branding across all platforms'] },
  s5a: { subs: ['Table of all planned posts', 'Platform, date, format, topic, caption, hashtags for each', 'Must show variety across platforms and formats'] },
  s5b: { subs: ['At least 3 different content formats across all posts', 'Examples: photo, video/reel, poll, story, link, question', 'Photo + photo + photo = ONE format. Be varied.'] },
  s5c: { subs: ['Minimum 5 published posts across all platforms', 'Screenshot of each post after publishing (showing live, not draft)', 'Annotation: what you posted, why, and how it links to your plan', 'Evidence of scheduling where applicable'] },
  s6:  { subs: ['Screenshots of replies to at least 2 comments or messages', 'Evidence of a poll or interactive content', 'Hashtag strategy in action (screenshot + analysis)', 'Auto-response, CTA button, or pinned post setup'] },
  s7a: { subs: ['Analytics data table for ALL platforms', 'Include: reach, impressions, likes, comments, shares, follower change', 'Cover the full posting period — not just the best posts', 'Real screenshots from platform analytics dashboards'] },
  s7b: { subs: ['Which post performed best and why', 'Which post performed worst and why', 'How well did results match your original target audience', 'What patterns do you notice across platforms', 'Compare your data to industry averages where possible'] },
  s8:  { subs: ['Define SEO and explain why it matters for social media', 'How your keyword strategy supports search rankings', 'How regular posting frequency affects SEO', 'Specific, justified recommendations to improve your SEO further'] },
  s9:  { subs: ['Justify platform choices (not describe — justify with data)', 'Justify target audience selection with evidence', 'Justify keyword choices with search data', 'Justify posting schedule with audience behaviour research', 'Link every decision to the specific business requirements'] },
  s10: { subs: ['Select 2 or more posts to improve', 'Before screenshot clearly labelled', 'After screenshot clearly labelled', 'Annotation explaining exactly what changed and why it is better', 'Test both versions on at least 2 different devices/screen sizes'] },
  s11: { subs: ['Did the plan meet the original business requirements? Why/why not?', 'What worked well — with specific data evidence', 'What did not work — with specific reasons', 'Were there any legal or ethical issues in your posts?', 'How did actual results compare to your original intentions?', 'Minimum 3 specific, justified recommendations for future improvement'] },
  s12: { subs: ['Time management table: planned vs actual time for each section', 'Reflection on whether you managed your time well', 'Specific examples of acting on feedback (from tutor and business owner)', 'Evidence of professional behaviour throughout the project', 'Reflection on your communication (with business, tutor, classmates)', 'Reflection on a problem you solved creatively'] },
}

const BAND_ORDER = ['pass', 'merit', 'distinction']
const BAND_LABELS = { pass: 'Pass', merit: 'Merit', distinction: 'Distinction' }
const BAND_COLORS = { pass: 'var(--pass)', merit: 'var(--merit)', distinction: 'var(--dist)' }
const BAND_LIGHT  = { pass: 'var(--pass-light)', merit: 'var(--merit-light)', distinction: 'var(--dist-light)' }

export default function SectionsPage({ student, onToggleSection }) {
  const [openId, setOpenId] = useState(null)
  const completed = student.completedSections || []
  const overrides = student.tutorOverrides || {}

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Sections</h2>
        <p style={{ color: 'var(--slate)', fontSize: 14 }}>Click a section to expand it. Mark it done when you have submitted on Canvas.</p>
      </div>

      {BAND_ORDER.map(band => (
        <div key={band} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h3 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 900,
              color: BAND_COLORS[band] }}>{BAND_LABELS[band]}</h3>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--slate)' }}>
              {SECTIONS.filter(s => s.band === band && completed.includes(s.id)).length} /
              {SECTIONS.filter(s => s.band === band).length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECTIONS.filter(s => s.band === band).map(sec => {
              const isDone     = completed.includes(sec.id)
              const isRejected = overrides[sec.id] === false
              const isVerified = overrides[sec.id] === true
              const isOpen     = openId === sec.id
              const crit       = CRIT_COLORS[sec.criteria] || {}
              const details    = SECTION_DETAILS[sec.id] || { subs: [] }

              return (
                <motion.div key={sec.id} layout
                  style={{
                    background: isRejected ? '#FFF0EF' : isDone ? BAND_LIGHT[band] : 'var(--white)',
                    border: `1.5px solid ${isRejected ? '#FCA5A5' : isDone ? BAND_COLORS[band] + '44' : 'var(--border)'}`,
                    borderRadius: 10, overflow: 'hidden',
                  }}>
                  {/* Header row */}
                  <button
                    onClick={() => setOpenId(isOpen ? null : sec.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 16px', textAlign: 'left',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      onClick={e => { e.stopPropagation(); onToggleSection(sec.id) }}
                      style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isRejected ? 'var(--red)' : isDone || isVerified ? BAND_COLORS[band] : 'var(--border)'}`,
                        background: isRejected ? 'var(--red-light)' : isDone || isVerified ? BAND_COLORS[band] : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 12, color: '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      {isRejected ? '✗' : (isDone || isVerified) ? '✓' : ''}
                    </div>

                    {/* Criteria tag */}
                    {sec.criteria && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                        background: crit.bg, color: crit.text, border: `1.5px solid ${crit.border}`,
                        borderRadius: 4, padding: '2px 7px', flexShrink: 0,
                      }}>{sec.criteria}</span>
                    )}

                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600,
                      color: isRejected ? 'var(--red)' : 'var(--navy)' }}>
                      {sec.title}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isVerified && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                          color: BAND_COLORS[band], background: BAND_LIGHT[band],
                          padding: '2px 8px', borderRadius: 4 }}>✓ Verified</span>
                      )}
                      {isRejected && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                          color: 'var(--red)', background: 'var(--red-light)',
                          padding: '2px 8px', borderRadius: 4 }}>✗ Rejected</span>
                      )}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                        color: 'var(--gold)' }}>+{sec.xp} XP</span>
                      <span style={{ fontSize: 12, color: 'var(--slate)',
                        transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '0 16px 16px', paddingLeft: 52 }}>
                          {isRejected && (
                            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--red-light)',
                              borderRadius: 6, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
                              ⚠️ Mr Ravindu has rejected this section. Resubmit on Canvas and wait for re-verification.
                            </div>
                          )}
                          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {details.subs.map((sub, i) => (
                              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--slate)' }}>
                                <span style={{ color: BAND_COLORS[band], fontWeight: 700, flexShrink: 0 }}>→</span>
                                <span>{sub}</span>
                              </li>
                            ))}
                          </ul>
                          {!isRejected && (
                            <button onClick={() => onToggleSection(sec.id)}
                              style={{
                                marginTop: 14, padding: '8px 18px', borderRadius: 20,
                                fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
                                border: `2px solid ${isDone ? BAND_COLORS[band] : 'var(--border)'}`,
                                background: isDone ? BAND_COLORS[band] : 'transparent',
                                color: isDone ? '#fff' : 'var(--slate)',
                                transition: 'all 0.15s',
                              }}>
                              {isDone ? '✓ Marked as Done' : '○ Mark as Done'}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
