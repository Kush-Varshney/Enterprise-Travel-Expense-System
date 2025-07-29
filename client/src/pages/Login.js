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
  const [forgotErrorTimeout, setForgotErrorTimeout] = useState(null)

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
      <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Left: Demo Credentials */}
        <div className="md:w-1/2 w-full flex flex-col justify-center items-center p-8 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 border-b md:border-b-0 md:border-r border-blue-200 dark:border-gray-700">
          <div className="w-full max-w-xs">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-200 mb-4 flex items-center">
              <span role="img" aria-label="test" className="mr-2">🧪</span> Demo Credentials
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-white/90 dark:bg-gray-800/90 border border-blue-200 dark:border-gray-600 p-4 shadow-sm">
                <div className="font-semibold text-blue-600 dark:text-blue-300 mb-1">Admin</div>
                <div className="text-sm text-gray-700 dark:text-gray-200"><span className="font-medium">Email:</span> admin@example.com</div>
                <div className="text-sm text-gray-700 dark:text-gray-200"><span className="font-medium">Password:</span> admin123</div>
              </div>
              <div className="rounded-lg bg-white/90 dark:bg-gray-800/90 border border-blue-200 dark:border-gray-600 p-4 shadow-sm">
                <div className="font-semibold text-blue-600 dark:text-blue-300 mb-1">Manager</div>
                <div className="text-sm text-gray-700 dark:text-gray-200"><span className="font-medium">Email:</span> manager@example.com</div>
                <div className="text-sm text-gray-700 dark:text-gray-200"><span className="font-medium">Password:</span> manager123</div>
              </div>
              <div className="rounded-lg bg-white/90 dark:bg-gray-800/90 border border-blue-200 dark:border-gray-600 p-4 shadow-sm">
                <div className="font-semibold text-blue-600 dark:text-blue-300 mb-1">Employee</div>
                <div className="text-sm text-gray-700 dark:text-gray-200"><span className="font-medium">Email:</span> employee@example.com</div>
                <div className="text-sm text-gray-700 dark:text-gray-200"><span className="font-medium">Password:</span> employee123</div>
              </div>
            </div>
            <div className="mt-8 text-xs text-gray-500 dark:text-gray-400 text-center">
              Use these credentials to explore all features as different roles.
            </div>
          </div>
        </div>
        {/* Right: Login Form */}
        <div className="md:w-1/2 w-full flex flex-col justify-center p-8">
          <div className="text-center animate-fade-in">
            <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center shadow-strong">
              <MapIcon className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to your Travel & Expense account</p>
          </div>
          <div className="card animate-slide-up mt-8">
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
                  setErrors({})
                  if (forgotErrorTimeout) clearTimeout(forgotErrorTimeout)
                  try {
                    const res = await fetch("/api/auth/forgot-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: forgotEmail })
                    })
                    const data = await res.json()
                    if (res.ok) {
                      setForgotStatus(data.message || "If that email is registered, a reset link has been sent.")
                      setForgotEmail("")
                      setTimeout(() => setForgotStatus(""), 4000)
                    } else {
                      setErrors({ forgotEmail: data.message || "This email is not registered with us." })
                      setForgotEmail("")
                      const timeout = setTimeout(() => setErrors({}), 4000)
                      setForgotErrorTimeout(timeout)
                    }
                  } catch {
                    setErrors({ forgotEmail: "Something went wrong. Please try again later." })
                    setForgotEmail("")
                    const timeout = setTimeout(() => setErrors({}), 4000)
                    setForgotErrorTimeout(timeout)
                  }
                }}>
                  <label htmlFor="forgotEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter your email to reset password</label>
                  <input id="forgotEmail" name="forgotEmail" type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="input-field" placeholder="your@email.com" />
                  <button type="submit" className="btn-primary w-full">Send Reset Link</button>
                  {forgotStatus && <div className="mt-2 text-sm text-green-600 dark:text-green-400">{forgotStatus}</div>}
                  {errors.forgotEmail && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.forgotEmail}</div>}
                  <div className="text-right mt-2">
                    <button type="button" className="text-blue-600 hover:underline text-sm" onClick={() => {
                      setShowForgot(false)
                      setForgotEmail("")
                      setForgotStatus("")
                      setErrors({})
                    }}>
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
    </div>
  )
}

export default Login
