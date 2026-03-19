import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import SessionLobby from './screens/SessionLobby.jsx'
import ActiveSession from './screens/ActiveSession.jsx'
import AuthScreen from './screens/AuthScreen.jsx'
import SessionSetup from './screens/SessionSetup.jsx'
import DashboardScreen from './screens/DashboardScreen.jsx'
import ProjectsScreen from './screens/ProjectsScreen.jsx'
import SessionResultsScreen from './screens/SessionResultsScreen.jsx'
import './shared/animations.css'

function push(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new Event('popstate'))
}

function parseRoute(pathname) {
  if (pathname === '/') return { name: 'root' }
  if (pathname === '/setup') return { name: 'setup' }
  if (pathname === '/dashboard') return { name: 'dashboard' }
  if (pathname === '/projects') return { name: 'projects' }
  if (pathname.startsWith('/projects/')) return { name: 'project', projectId: pathname.split('/')[2] }
  if (pathname.startsWith('/sessions/') && pathname.endsWith('/results')) return { name: 'results', sessionId: pathname.split('/')[2] }
  return { name: 'dashboard' }
}

export default function App() {
  const [screen, setScreen] = useState('loading')
  const [user, setUser] = useState(null)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [route, setRoute] = useState(parseRoute(window.location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)

    supabase.auth.getSession().then(({ data }) => {
      const u = data?.session?.user || null
      setUser(u)
      setScreen(u ? 'app' : 'auth')

      if (u && window.location.pathname === '/') {
        push('/dashboard')
      }
      if (!u && window.location.pathname !== '/') {
        push('/')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null
      setUser(u)
      if (u) {
        setScreen('app')
        if (window.location.pathname === '/') push('/dashboard')
      } else {
        setActiveSessionId(null)
        setScreen('auth')
        if (window.location.pathname !== '/') push('/')
      }
    })

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  if (screen === 'loading') return <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'grid', placeItems: 'center', color: '#f0c040' }}>⚙️ LOADING...</div>
  if (!user) return <AuthScreen />

  if (activeSessionId) {
    return <ActiveSession sessionId={activeSessionId} onBack={() => setActiveSessionId(null)} />
  }

  if (route.name === 'setup') {
    return <SessionSetup onBack={() => push('/dashboard')} onSessionCreated={(session) => setActiveSessionId(session.id)} />
  }

  if (route.name === 'projects') {
    return <ProjectsScreen onBack={() => push('/dashboard')} onOpenProject={(id) => push(`/projects/${id}`)} />
  }

  if (route.name === 'project') {
    return <ProjectsScreen projectId={route.projectId} onBack={() => push('/projects')} />
  }

  if (route.name === 'results') {
    return <SessionResultsScreen sessionId={route.sessionId} onBack={() => push('/dashboard')} />
  }

  return (
    <DashboardScreen
      onOpenSession={(id) => setActiveSessionId(id)}
      onSetup={() => push('/setup')}
      onOpenProjects={() => push('/projects')}
      onOpenProject={(id) => push(`/projects/${id}`)}
      onOpenResults={(id) => push(`/sessions/${id}/results`)}
    />
  )
}
