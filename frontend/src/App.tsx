import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AppLayout } from './components/AppLayout'
import { AuthPage } from './pages/AuthPage'
import { BusinessPage } from './pages/BusinessPage'
import { ChatPage } from './pages/ChatPage'
import { FeedPage } from './pages/FeedPage'
import { FriendsPage } from './pages/FriendsPage'
import { LandingPage } from './pages/LandingPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ReelsPage } from './pages/ReelsPage'
import { isBusinessHost } from './lib/businessRoutes'

function App() {
  const { user, loading } = useAuth()
  const businessHost = isBusinessHost()

  if (loading) {
    return <div className="boot-screen">Loading Zumers</div>
  }

  return (
    <Routes>
      {businessHost ? (
        <>
          <Route path="/" element={<BusinessPage mode="landing" />} />
          <Route
            path="/signup"
            element={<BusinessPage mode="landing" initialAuth="signup" />}
          />
          <Route
            path="/login"
            element={<BusinessPage mode="landing" initialAuth="login" />}
          />
          <Route path="/dashboard" element={<BusinessPage mode="dashboard" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />}
          />
          <Route
            path="/signup"
            element={
              user ? <Navigate to="/" replace /> : <AuthPage mode="signup" />
            }
          />
          <Route path="/business" element={<BusinessPage mode="landing" />} />
          <Route
            path="/business/signup"
            element={<BusinessPage mode="landing" initialAuth="signup" />}
          />
          <Route
            path="/business/login"
            element={<BusinessPage mode="landing" initialAuth="login" />}
          />
          <Route path="/business/dashboard" element={<BusinessPage mode="dashboard" />} />
          <Route
            path="/"
            element={user ? <AppLayout /> : <LandingPage />}
          >
            <Route index element={<FeedPage />} />
            <Route path="reels" element={<ReelsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </>
      )}
    </Routes>
  )
}

export default App
