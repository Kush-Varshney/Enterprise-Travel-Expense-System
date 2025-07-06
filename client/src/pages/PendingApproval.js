import React, { useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import { useNavigate, Link } from "react-router-dom"

const PendingApproval = () => {
  const { user, loadUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && user.isActive) {
      navigate("/dashboard")
    }
    const interval = setInterval(async () => {
      await loadUser()
    }, 1000)
    return () => clearInterval(interval)
  }, [user, navigate, loadUser])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 card animate-slide-up">
        <div className="card-body text-center">
          <h2 className="text-2xl font-bold mb-4 text-center text-gray-900 dark:text-white">Account Pending Approval</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Your account is pending admin approval. You will get access once your account is activated.<br/>
            This page will update automatically when your account is approved.
          </p>
          <Link to="/login" className="btn-primary">Back to Login</Link>
        </div>
      </div>
    </div>
  )
}

export default PendingApproval 