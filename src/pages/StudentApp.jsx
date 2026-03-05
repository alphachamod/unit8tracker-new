import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { saveProgress, getStudent } from '../lib/firebase'
import { SECTIONS, BADGES, TOTAL_XP, PASS_XP, PASS_MERIT_XP, calcXP, checkBadges, SECTION_POPUPS, DEADLINE, START_DATE } from '../data/gameData'
import HomePage from './student/HomePage'
import TimelinePage from './student/TimelinePage'
import SectionsPage from './student/SectionsPage'
import LeaderboardPage from './student/LeaderboardPage'
import IntegrityPage from './student/IntegrityPage'
import ResourcesPage from './student/ResourcesPage'
import FAQPage from './student/FAQPage'
import SectionPopup from '../components/SectionPopup'
import Toast from '../components/Toast'
import LoadingScreen from '../components/LoadingScreen'

const NAV_ITEMS = [
  { id:'home', label:'Home', emoji:'🏠' },
  { id:'timeline', label:'Timeline', emoji:'📅' },
  { id:'sections', label:'Sections', emoji:'📋' },
  { id:'leaderboard', label:'Board', emoji:'🏆' },
  { id:'integrity', label:'Integrity', emoji:'⚠️' },
  { id:'resources', label:'Resources', emoji:'🔗' },
  { id:'faq', label:'FAQ', emoji:'💬' },
]

export default function StudentApp({ student, setStudent, onLogout }) {
  const [page, setPage] = useState('home')
  const [popup, setPopup] = useState(null)
  const [toast, setToast] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)
  const syncTimer = useRef(null)

  // FIX 1: Pull fresh data on mount AND recalculate XP from server state
  // This ensures tutor overrides are reflected immediately on login
  useEffect(() => {
    getStudent(student.studentId).then(fresh => {
      if (fresh) {
        const recalcedXP = calcXP(fresh.completedSections || [], fresh.badges || [])
        setStudent(s => ({ ...s, ...fresh, xp: recalcedXP }))
      }
    }).catch(() => {})
  }, [])

  // Debounced sync to Firebase
  const scheduleSync = useCallback((data) => {
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      saveProgress(data.studentId, {
        completedSections: data.completedSections,
        xp: data.xp,
        badges: data.badges,
        completedTimestamps: data.completedTimestamps || {},
      }).catch(() => {})
    }, 1500)
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // FIX 2: Block unticking tutor-verified sections
  // FIX 3: XP always recalculated from scratch — never additive
  function toggleSection(sectionId) {
    setStudent(prev => {
      const completed  = prev.completedSections || []
      const overrides  = prev.tutorOverrides || {}
      const timestamps = prev.completedTimestamps || {}
      const alreadyDone = completed.includes(sectionId)

      // Tutor-rejected: block toggle
      if (overrides[sectionId] === false) {
        showToast('⚠️ Rejected by Mr Ravindu — resubmit on Canvas first')
        return prev
      }

      // Tutor-verified: block unticking — tutor owns this section
      if (overrides[sectionId] === true) {
        showToast('✓ Verified by Mr Ravindu — this section cannot be unticked')
        return prev
      }

      // Normal toggle
      const newCompleted = alreadyDone
        ? completed.filter(id => id !== sectionId)
        : [...completed, sectionId]

      // Record timestamp when ticked — remove when unticked
      const newTimestamps = { ...timestamps }
      if (!alreadyDone) newTimestamps[sectionId] = Date.now()
      else delete newTimestamps[sectionId]

      const prevBadgeIds = prev.badges || []
      const newBadgeIds  = checkBadges(newCompleted, 0, prev.streak || 1, overrides)
      const earnedNow    = newBadgeIds.filter(id => !prevBadgeIds.includes(id))
      const allBadges    = [...new Set([...prevBadgeIds, ...newBadgeIds])]

      // Always recalculate from scratch — never accumulate on top of old value
      const newXP = calcXP(newCompleted, allBadges)

      const updated = { ...prev, completedSections: newCompleted, xp: newXP, badges: allBadges, completedTimestamps: newTimestamps }
      scheduleSync(updated)

      if (!alreadyDone) {
        const sec = SECTIONS.find(s => s.id === sectionId)
        setTimeout(() => setPopup({ sectionId, xp: sec?.xp || 0 }), 200)
        earnedNow.forEach((bid, i) => {
          const badge = BADGES.find(b => b.id === bid)
          if (badge) setTimeout(() => showToast(`🏅 +${badge.xpBonus} XP — Badge: ${badge.name}!`), 800 + i * 600)
        })
      } else {
        showToast(`Unmarked — ${SECTIONS.find(s => s.id === sectionId)?.short}`)
      }

      return updated
    })
  }

  function navigateTo(newPage) {
    if (newPage === page) return
    setPageLoading(true)
    setTimeout(() => {
      setPage(newPage)
      setPageLoading(false)
    }, 400)
  }

  const firstName = student.name?.split(' ')[0] || 'Student'
  const xp = student.xp || 0
  const grade = xp >= TOTAL_XP ? 'D' : xp >= PASS_MERIT_XP ? 'M' : xp >= PASS_XP ? 'P' : '—'

  if (pageLoading) return <LoadingScreen message='Loading...' />

  return (
    <div style={{ minHeight:'100vh', background:'var(--light)' }}>
      {/* NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:'var(--white)',
        borderBottom:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 20px', height:58,
          display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'#fff',
              background:'var(--navy)', padding:'3px 8px', borderRadius:4 }}>Unit 8</span>
            <span style={{ fontFamily:'var(--font-head)', fontSize:14, fontWeight:700, color:'var(--navy)',
              display: window.innerWidth < 500 ? 'none' : 'block' }}>Social Media</span>
          </div>

          {/* Desktop nav */}
          <ul style={{ display:'flex', gap:2, listStyle:'none', marginLeft:'auto', alignItems:'center' }}
            className="desktop-nav">
            {NAV_ITEMS.map(item => (
              <li key={item.id}>
                <button onClick={() => navigateTo(item.id)}
                  style={{ fontSize:13, fontWeight:500, padding:'6px 10px', borderRadius:6,
                    background: page===item.id ? 'var(--navy)' : 'transparent',
                    color: page===item.id ? '#fff' : 'var(--slate)',
                    transition:'all 0.15s' }}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft: window.innerWidth < 700 ? 'auto' : 8 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--gold)', fontWeight:700 }}>{xp} XP</span>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--navy)' }}>{firstName}</span>
            </div>
            <button onClick={onLogout} title="Log out"
              style={{ fontSize:16, color:'var(--slate)', padding:'6px', borderRadius:6, transition:'all 0.15s' }}
              onMouseEnter={e => { e.target.style.background='var(--red-light)'; e.target.style.color='var(--red)' }}
              onMouseLeave={e => { e.target.style.background='transparent'; e.target.style.color='var(--slate)' }}>
              ⏏
            </button>
            {/* Hamburger */}
            <button onClick={() => setMenuOpen(o => !o)}
              style={{ display:'none', flexDirection:'column', gap:5, padding:6 }}
              className="hamburger">
              <span style={{ width:22, height:2, background:'var(--navy)', borderRadius:2, display:'block',
                transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none', transition:'all 0.2s' }}/>
              <span style={{ width:22, height:2, background:'var(--navy)', borderRadius:2, display:'block',
                opacity: menuOpen ? 0 : 1, transition:'all 0.2s' }}/>
              <span style={{ width:22, height:2, background:'var(--navy)', borderRadius:2, display:'block',
                transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none', transition:'all 0.2s' }}/>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
              style={{ overflow:'hidden', borderTop:'1px solid var(--border)', background:'var(--white)' }}>
              <div style={{ padding:'8px 16px 12px', display:'flex', flexDirection:'column', gap:2 }}>
                {NAV_ITEMS.map(item => (
                  <button key={item.id} onClick={() => { navigateTo(item.id); setMenuOpen(false) }}
                    style={{ textAlign:'left', padding:'10px 12px', borderRadius:8, fontSize:14, fontWeight:500,
                      background: page===item.id ? 'var(--navy)' : 'transparent',
                      color: page===item.id ? '#fff' : 'var(--slate)' }}>
                    {item.emoji} {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* PAGE CONTENT */}
      <main style={{ maxWidth:900, margin:'0 auto', padding:'32px 20px 80px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={page} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0 }} transition={{ duration:0.2 }}>
            {page === 'home'        && <HomePage student={student} onToggleSection={toggleSection} onNavigate={navigateTo} />}
            {page === 'timeline'    && <TimelinePage student={student} />}
            {page === 'sections'    && <SectionsPage student={student} onToggleSection={toggleSection} />}
            {page === 'leaderboard' && <LeaderboardPage student={student} />}
            {page === 'integrity'   && <IntegrityPage />}
            {page === 'resources'   && <ResourcesPage />}
            {page === 'faq'         && <FAQPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer style={{ borderTop:'1px solid var(--border)', background:'var(--white)', padding:'14px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', justifyContent:'space-between',
          fontSize:12, color:'var(--slate)', fontFamily:'var(--font-mono)', flexWrap:'wrap', gap:6 }}>
          <span>Unit 8 · BTEC Level 3 · Assignment 02</span>
          <span>Deadline: 15 April 2026</span>
        </div>
      </footer>

      <AnimatePresence>
        {popup && <SectionPopup sectionId={popup.sectionId} xp={popup.xp} onClose={() => setPopup(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <Toast message={toast} />}
      </AnimatePresence>

      <style>{`
        @media (max-width: 700px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  )
}