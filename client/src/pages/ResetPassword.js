import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"

const ResetPassword = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [tokenValid, setTokenValid] = useState(true)
  const [checkingToken, setCheckingToken] = useState(true)

  useEffect(() => {
    // Validate token on mount
    const validateToken = async () => {
      setCheckingToken(true)
      try {
        const res = await fetch(`/api/auth/validate-reset-token?token=${token}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.message || "Invalid or expired token.")
          setTokenValid(false)
        } else {
          setTokenValid(true)
        }
      } catch {
        setError("Something went wrong. Please try again later.")
        setTokenValid(false)
      }
      setCheckingToken(false)
    }
    validateToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setStatus("")
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("Password has been reset. Redirecting to login and closing this tab...")
        setTimeout(() => {
          navigate("/login")
          setTimeout(() => window.close(), 500)
        }, 2000)
      } else {
        setError(data.message || "Invalid or expired token.")
        setTokenValid(false)
      }
    } catch {
      setError("Something went wrong. Please try again later.")
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 card animate-slide-up">
        <div className="card-body">
          <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>
          {checkingToken ? (
            <div className="text-center">Checking token...</div>
          ) : tokenValid ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                <input id="password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="Enter new password" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-field" placeholder="Confirm new password" />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {status && <div className="text-green-600 text-sm">{status}<br />If this tab does not close automatically, please close it manually.</div>}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? "Resetting..." : "Reset Password"}</button>
            </form>
          ) : (
            <div className="text-red-600 text-center">{error || "Invalid or expired token."} <br /><Link to="/login" className="text-blue-600 underline">Go to Login</Link></div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPassword 