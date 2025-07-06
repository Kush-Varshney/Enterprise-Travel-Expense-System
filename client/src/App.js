import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { AuthProvider } from "./contexts/AuthContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import TravelRequests from "./pages/TravelRequests"
import ExpenseClaims from "./pages/ExpenseClaims"
import Notifications from "./pages/Notifications"
import Profile from "./pages/Profile"
import UserManagement from "./pages/UserManagement"
import Approvals from "./pages/Approvals"
import ResetPassword from "./pages/ResetPassword"
import PendingApproval from "./pages/PendingApproval"
import { NotificationProvider } from "./contexts/NotificationContext"
import AuditLog from "./pages/AuditLog"

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="travel-requests" element={<TravelRequests />} />
                  <Route path="expense-claims" element={<ExpenseClaims />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="approvals" element={<Approvals />} />
                  <Route path="audit-log" element={<AuditLog />} />
                </Route>
              </Routes>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: "var(--toast-bg)",
                    color: "var(--toast-color)",
                  },
                }}
              />
            </div>
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
