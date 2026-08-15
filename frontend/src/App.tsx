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

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="boot-screen">Loading Zumers</div>
  }

  return (
    <Routes>
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
      <Route path="/business/signup" element={<BusinessPage mode="signup" />} />
      <Route path="/business/login" element={<BusinessPage mode="login" />} />
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
    </Routes>
  )
}

export default App
