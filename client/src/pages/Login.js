"use client"

import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { EyeIcon, EyeSlashIcon, MapIcon } from "@heroicons/react/24/outline"
import { useAuth } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"

const Login = () => {
  const { login, isAuthenticated, loading } = useAuth()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotStatus, setForgotStatus] = useState("")

  if (isAuthenticated && !loading) {
    return <Navigate to="/dashboard" replace />
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    const result = await login(formData)

    setIsSubmitting(false)

    if (result.success) {
      // Success handling is done in the context
    } else {
      if (result.status === 403 && result.message && result.message.includes('pending admin approval')) {
        // Show a special message to the user
        setErrors({ email: "Your account is awaiting admin approval." })
      } else if (result.status === 429) {
        // Show a message and disable the login button for the wait time
        setErrors({ email: "Too many login attempts. Please wait and try again later." })
      } else {
        // Error handling is done in the context
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center animate-fade-in">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center shadow-strong">
            <MapIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to your Travel & Expense account</p>
        </div>

        <div className="card animate-slide-up">
          <div className="card-body">
            {!showForgot ? (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className={`input-field ${errors.email ? "border-red-500" : ""}`}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="input-field pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="small" className="mr-2" />
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </button>
                </div>
                <div className="text-right mt-2">
                  <button type="button" className="text-blue-600 hover:underline text-sm" onClick={() => setShowForgot(true)}>
                    Forgot Password?
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-6" onSubmit={async (e) => {
                e.preventDefault()
                setForgotStatus("")
                try {
                  const res = await fetch("/api/auth/forgot-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: forgotEmail })
                  })
                  const data = await res.json()
                  setForgotStatus(data.message || "If that email is registered, a reset link has been sent.")
                } catch {
                  setForgotStatus("Something went wrong. Please try again later.")
                }
              }}>
                <label htmlFor="forgotEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter your email to reset password</label>
                <input id="forgotEmail" name="forgotEmail" type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="input-field" placeholder="your@email.com" />
                <button type="submit" className="btn-primary w-full">Send Reset Link</button>
                {forgotStatus && <div className="mt-2 text-sm text-green-600 dark:text-green-400">{forgotStatus}</div>}
                <div className="text-right mt-2">
                  <button type="button" className="text-blue-600 hover:underline text-sm" onClick={() => setShowForgot(false)}>
                    Back to Login
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    Don't have an account?
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Link to="/register" className="w-full btn-secondary flex justify-center">
                  Create new account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
