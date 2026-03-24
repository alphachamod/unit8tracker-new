import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { STUDENT_ROSTER } from '../data/gameData'
import { getStudent, ensureAuth, signInTutor } from '../lib/firebase'

export default function Login({ onStudentLogin, onTutorLogin }) {
  const [tab, setTab]             = useState('student')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const name = STUDENT_ROSTER[studentId.toUpperCase()]

  async function handleStudentLogin() {
    const id = studentId.toUpperCase().trim()
    if (!STUDENT_ROSTER[id]) { setError('Student ID not recognised. Check and try again.'); return }
    setLoading(true); setError('')
    try {
      await ensureAuth()
      const data = await getStudent(id)
      onStudentLogin({
        studentId: id,
        name: STUDENT_ROSTER[id],
        completedSections: [],
        xp: 0,
        badges: [],
        streak: 0,
        tutorOverrides: {},
        tutorNote: '',
        ...(data && typeof data === 'object' ? data : {}),
        // Always keep the roster name as source of truth
        name: STUDENT_ROSTER[id],
        studentId: id,
      })
    } catch (e) {
      setError('Could not connect. Check your internet connection.')
    }
    setLoading(false)
  }

  async function handleTutorLogin() {
    setLoading(true); setError('')
    try {
      await signInTutor()
      onTutorLogin()
    } catch (e) {
      setError(e.message || 'Sign-in failed. Make sure you use the authorised Google account.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#1a2035 100%)', padding:24, position:'relative', overflow:'hidden' }}>
      {/* Background glow */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none',
        background:'radial-gradient(ellipse at 20% 50%,rgba(31,107,58,0.15) 0%,transparent 60%), radial-gradient(ellipse at 80% 20%,rgba(139,98,0,0.12) 0%,transparent 50%)' }}/>

      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4, ease:[0.16,1,0.3,1] }}
        style={{ background:'rgba(255,255,255,0.97)', borderRadius:20, padding:'44px 40px',
          width:'100%', maxWidth:420, boxShadow:'0 24px 60px rgba(0,0,0,0.35)', position:'relative', zIndex:1 }}>

        <div style={{ marginBottom:16 }}>
          <span style={{ background:'var(--navy)', color:'#fff', fontFamily:'var(--font-mono)',
            fontSize:11, fontWeight:700, letterSpacing:'0.1em', padding:'4px 10px', borderRadius:6 }}>Unit 8</span>
        </div>
        <h1 style={{ fontFamily:'var(--font-head)', fontSize:30, fontWeight:900, color:'var(--navy)',
          lineHeight:1.15, marginBottom:6 }}>Social Media<br/>in Business</h1>
        <p style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--slate)', marginBottom:28 }}>
          BTEC Level 3 · Assignment 02</p>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'var(--light)', borderRadius:8, padding:4, marginBottom:24 }}>
          {['student','tutor'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError('') }}
              style={{ flex:1, padding:'8px', borderRadius:6, fontSize:13, fontWeight:600,
                background: tab===t ? 'var(--white)' : 'transparent',
                color: tab===t ? 'var(--navy)' : 'var(--slate)',
                boxShadow: tab===t ? 'var(--shadow)' : 'none',
                transition:'all 0.15s', textTransform:'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'student' ? (
            <motion.div key="student" initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:10 }}
              style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--navy)', letterSpacing:'0.03em' }}>Student ID</label>
                <input value={studentId} onChange={e => { setStudentId(e.target.value); setError('') }}
                  onKeyDown={e => e.key==='Enter' && handleStudentLogin()}
                  placeholder="e.g. ABD24224712" autoComplete="off"
                  style={{ width:'100%', padding:'11px 14px', border:'1.5px solid var(--border)',
                    borderRadius:8, fontSize:14, color:'var(--navy)', textTransform:'uppercase',
                    transition:'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor='var(--navy)'}
                  onBlur={e => e.target.style.borderColor='var(--border)'}/>
              </div>

              <AnimatePresence>
                {name && (
                  <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                      background:'var(--pass-light)', border:'1.5px solid var(--pass-mid)',
                      borderRadius:8, fontSize:14, fontWeight:600, color:'var(--pass)' }}>
                    <span style={{ fontSize:18 }}>👋</span> Hi, {name}!
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={handleStudentLogin} disabled={loading}
                style={{ padding:13, background: loading ? '#94a3b8' : 'var(--navy)', color:'#fff',
                  borderRadius:8, fontSize:14, fontWeight:700, letterSpacing:'0.03em',
                  transition:'all 0.15s', cursor: loading ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => !loading && (e.target.style.background='var(--navy-mid)')}
                onMouseLeave={e => !loading && (e.target.style.background='var(--navy)')}>
                {loading ? 'Loading...' : "Let's Go →"}
              </button>
              <p style={{ fontSize:11, color:'var(--slate)', textAlign:'center', lineHeight:1.5 }}>
                Enter your Student ID — your name will be recognised automatically.
              </p>
            </motion.div>
          ) : (
            <motion.div key="tutor" initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-10 }}
              style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Google sign-in info */}
              <div style={{ padding:'14px 16px', background:'#F0FDF4', border:'1.5px solid #BBF7D0',
                borderRadius:10, fontSize:13, color:'#166534', lineHeight:1.5 }}>
                🔒 Tutor access is secured with Google Sign-In.<br/>
                Only the authorised account can access this dashboard.
              </div>

              <button onClick={handleTutorLogin} disabled={loading}
                style={{ padding:13, background: loading ? '#94a3b8' : '#fff', color: loading ? '#fff' : 'var(--navy)',
                  borderRadius:8, fontSize:14, fontWeight:700, transition:'all 0.15s',
                  border:'1.5px solid var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  cursor: loading ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => !loading && (e.currentTarget.style.borderColor='var(--navy)')}
                onMouseLeave={e => !loading && (e.currentTarget.style.borderColor='var(--border)')}>
                {!loading && (
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Sign in with Google'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              style={{ marginTop:12, padding:'10px 14px', background:'var(--red-light)',
                border:'1px solid #FCA5A5', borderRadius:8, fontSize:13, color:'var(--red)', textAlign:'center' }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}