import { useState, useCallback } from 'react'
import Login from './pages/Login'
import StudentApp from './pages/StudentApp'
import TutorDashboard from './pages/TutorDashboard'
import './index.css'

export default function App() {
  const [view, setView] = useState('login')
  const [student, setStudent] = useState(null)

  const handleStudentLogin = useCallback((studentData) => {
    setStudent(studentData)
    setView('student')
  }, [])

  const handleTutorLogin = useCallback(() => {
    setView('tutor')
  }, [])

  const handleLogout = useCallback(() => {
    setStudent(null)
    setView('login')
  }, [])

  if (view === 'student' && student) {
    return <StudentApp student={student} setStudent={setStudent} onLogout={handleLogout} />
  }
  if (view === 'tutor') {
    return <TutorDashboard onLogout={handleLogout} />
  }
  return <Login onStudentLogin={handleStudentLogin} onTutorLogin={handleTutorLogin} />
}
