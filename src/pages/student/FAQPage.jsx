import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FAQ_DATA } from '../../data/gameData'

export function FAQPage() {
  const [open, setOpen] = useState(null)
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>FAQ</h2>
        <p style={{ color: 'var(--slate)', fontSize: 14 }}>Common questions — read these before messaging.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FAQ_DATA.map((item, i) => (
          <motion.div key={i} layout style={{ background: 'var(--white)', borderRadius: 10,
            border: `1.5px solid ${open === i ? 'var(--navy)' : 'var(--border)'}`, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '14px 16px', textAlign: 'left', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.4 }}>{item.q}</span>
              <span style={{ fontSize: 12, color: 'var(--slate)', flexShrink: 0,
                transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
            </button>
            <AnimatePresence>
              {open === i && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  style={{ overflow: 'hidden' }}>
                  <p style={{ padding: '0 16px 14px', fontSize: 14, color: 'var(--slate)', lineHeight: 1.7 }}>{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function IntegrityPage() {
  const rules = [
    { icon: '✅', title: 'You CAN use AI tools', desc: 'Use AI for generating images, drafting captions (then personalise them), grammar checking, and brainstorming ideas.' },
    { icon: '❌', title: 'You CANNOT use AI to write your work', desc: 'Evaluations, justifications, reflections, and analysis must be your own thinking. AI cannot evaluate your specific posts or your specific data.' },
    { icon: '❌', title: 'Never fabricate data', desc: 'One real like is worth more than a screenshot of 200 fake likes. Fabricated data is academic misconduct and will be reported.' },
    { icon: '❌', title: 'Never fabricate screenshots', desc: 'We can verify whether posts were actually published. Fake or edited screenshots are academic misconduct.' },
    { icon: '❌', title: 'Never submit someone else\'s work', desc: 'This includes buying work online, sharing work with classmates, or letting someone else complete sections.' },
    { icon: '⚠️', title: 'Resubmissions are capped at Pass', desc: 'If your work is rejected and you resubmit, the maximum grade you can receive is a Pass — regardless of quality.' },
    { icon: '📋', title: 'All AI use must be declared', desc: 'If you used any AI tool at any point, declare it in your work. Non-declaration is treated the same as fabrication.' },
  ]
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Academic Integrity</h2>
        <p style={{ color: 'var(--slate)', fontSize: 14 }}>What you can and cannot do on this assignment.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ background: 'var(--white)', borderRadius: 10, padding: '16px',
            border: `1.5px solid ${r.icon === '✅' ? 'var(--pass-mid)' : r.icon === '⚠️' ? '#FCA5A5' : 'var(--border)'}`,
            display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: 'var(--slate)', lineHeight: 1.6 }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ResourcesPage() {
  const links = [
    { cat: 'Assignment', items: [
      { name: 'Unit 8 Student Template', desc: 'The Word doc template you submit', href: '#' },
      { name: 'Unit 8 Assignment Brief', desc: 'Full brief with all criteria', href: '#' },
    ]},
    { cat: 'Tools', items: [
      { name: 'Google Keyword Planner', desc: 'Keyword research for Section 2c', href: 'https://ads.google.com/home/tools/keyword-planner/' },
      { name: 'Later.com', desc: 'Schedule posts across platforms', href: 'https://later.com' },
      { name: 'Buffer', desc: 'Free social media scheduler', href: 'https://buffer.com' },
      { name: 'Canva', desc: 'Design social media graphics', href: 'https://canva.com' },
    ]},
    { cat: 'Analytics', items: [
      { name: 'Instagram Insights', desc: 'Settings → Insights', href: 'https://instagram.com' },
      { name: 'Facebook Business Suite', desc: 'Insights for Facebook & Instagram', href: 'https://business.facebook.com' },
      { name: 'TikTok Analytics', desc: 'Creator tools in TikTok app', href: 'https://tiktok.com' },
    ]},
  ]
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Resources</h2>
        <p style={{ color: 'var(--slate)', fontSize: 14 }}>Everything you need, in one place.</p>
      </div>
      {links.map(cat => (
        <div key={cat.cat} style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--slate)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{cat.cat}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cat.items.map(item => (
              <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer"
                style={{ background: 'var(--white)', borderRadius: 10, padding: '14px 16px',
                  border: '1.5px solid var(--border)', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: 12, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--navy)'; e.currentTarget.style.boxShadow='var(--shadow)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>{item.desc}</div>
                </div>
                <span style={{ color: 'var(--slate)', fontSize: 16, flexShrink: 0 }}>→</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default FAQPage
