import { useState, useCallback } from 'react'
import Login from './pages/Login'
import StudentApp from './pages/StudentApp'
import TutorDashboard from './pages/TutorDashboard'
import './index.css'

function loadSession() {
  try {
    const raw = sessionStorage.getItem('unit8_session')
    if (!raw) return { view: 'login', student: null }
    const { view, student } = JSON.parse(raw)
    return { view: view || 'login', student: student || null }
  } catch { return { view: 'login', student: null } }
}

function saveSession(view, student) {
  try { sessionStorage.setItem('unit8_session', JSON.stringify({ view, student })) }
  catch {}
}

function clearSession() {
  try { sessionStorage.removeItem('unit8_session') }
  catch {}
}

export default function App() {
  const initial = loadSession()
  const [view, setView]       = useState(initial.view)
  const [student, setStudent] = useState(initial.student)

  const handleStudentLogin = useCallback((studentData) => {
    setStudent(studentData)
    setView('student')
    saveSession('student', studentData)
  }, [])

  const handleTutorLogin = useCallback(() => {
    setView('tutor')
    saveSession('tutor', null)
  }, [])

  const handleLogout = useCallback(() => {
    setStudent(null)
    setView('login')
    clearSession()
  }, [])

  // Keep session in sync when student data updates (XP, badges etc.)
  const handleSetStudent = useCallback((updater) => {
    setStudent(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveSession('student', next)
      return next
    })
  }, [])

  if (view === 'student' && student) {
    return <StudentApp student={student} setStudent={handleSetStudent} onLogout={handleLogout} />
  }
  if (view === 'tutor') {
    return <TutorDashboard onLogout={handleLogout} />
  }
  return <Login onStudentLogin={handleStudentLogin} onTutorLogin={handleTutorLogin} />
}