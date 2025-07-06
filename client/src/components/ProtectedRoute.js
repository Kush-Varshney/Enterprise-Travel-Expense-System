"use client"
import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import LoadingSpinner from "./LoadingSpinner"

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && user.role === "Employee" && user.isActive === false) {
    return <Navigate to="/pending-approval" replace />
  }

  return children
}

export default ProtectedRoute
