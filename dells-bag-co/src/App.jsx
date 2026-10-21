import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { ProductProvider } from './context/ProductContext.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SellerDashboard from './pages/SellerDashboard.jsx'
import Shop from './pages/Shop.jsx'
import Orders from './pages/Orders.jsx'
import Profile from './pages/Profile.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

function Loader() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <span className="spinner-border text-secondary" role="status" aria-hidden="true"></span>
    </div>
  )
}

// Firebase restores the session asynchronously on a hard refresh, so wait for
// authReady before deciding to bounce anyone to /login.
function RequireAuth({ children }) {
  const { isAuthenticated, isAdmin, authReady } = useAuth()

  if (!authReady && !isAuthenticated) return <Loader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  // An admin who lands on a shopper route goes to their own dashboard.
  if (isAdmin) return <Navigate to="/admin-dashboard" replace />

  return children
}

function RequireAdminAuth({ children }) {
  const { isAdmin, authReady, isAuthenticated } = useAuth()
  if (!authReady && !isAuthenticated) return <Loader />
  if (!isAdmin) return <Navigate to="/login" replace />

  return children
}

// Already signed in? Skip the login screen and go where you belong.
function RedirectIfAuthed({ children }) {
  const { isAuthenticated, isAdmin, authReady } = useAuth()
  if (!authReady) return children
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin-dashboard' : '/dashboard'} replace />
  }
  return children
}

function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <CartProvider>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/signup"
            element={
              <RedirectIfAuthed>
                <Signup />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/seller-dashboard"
            element={
              <RequireAuth>
                <SellerDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/shop"
            element={
              <RequireAuth>
                <Shop />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <RequireAdminAuth>
                <AdminDashboard />
              </RequireAdminAuth>
            }
          />
          <Route path="/admin" element={<Navigate to="/admin-dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </ProductProvider>
    </AuthProvider>
  )
}

export default App
