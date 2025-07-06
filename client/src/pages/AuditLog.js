import { useEffect, useState } from "react"
import axios from "axios"
import { useAuth } from "../contexts/AuthContext"

const AuditLog = () => {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ userId: "", action: "", startDate: "", endDate: "" })
  const [actions, setActions] = useState([])
  const [users, setUsers] = useState([])
  const [userFetchError, setUserFetchError] = useState("")

  useEffect(() => {
    if (user?.role === "Admin") {
      fetchLogs()
      fetchUsers()
    }
  }, [user])

  const fetchLogs = async (params = {}) => {
    setLoading(true)
    try {
      // Only include non-empty params
      const filteredParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v))
      const query = new URLSearchParams(filteredParams).toString()
      const res = await axios.get(`/api/users/audit-log${query ? `?${query}` : ""}`)
      setLogs(res.data.logs)
      // Collect unique actions for filter dropdown
      const uniqueActions = [...new Set(res.data.logs.map(l => l.action))]
      setActions(uniqueActions)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await axios.get("/api/users")
      setUsers(res.data.users || [])
      setUserFetchError("")
    } catch (err) {
      setUserFetchError("Unable to load users for filtering.")
    }
  }

  const handleFilterChange = e => {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleFilterSubmit = e => {
    e.preventDefault()
    fetchLogs(filters)
  }

  if (user?.role !== "Admin") {
    return <div className="p-8 text-center text-red-600">Access denied.</div>
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
      {/* Filter UI */}
      <form className="flex flex-wrap gap-4 items-end mb-4" onSubmit={handleFilterSubmit}>
        <div className="min-w-[180px] flex-1">
          <label className="form-label">User</label>
          <select name="userId" value={filters.userId} onChange={handleFilterChange} className="input-field">
            <option value="">All</option>
            {users.map(u => (
              <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.email})</option>
            ))}
          </select>
          {userFetchError && <div className="form-error">{userFetchError}</div>}
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="form-label">Action</label>
          <select name="action" value={filters.action} onChange={handleFilterChange} className="input-field">
            <option value="">All</option>
            {actions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="form-label">Start Date</label>
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="input-field" />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="form-label">End Date</label>
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="input-field" />
        </div>
        <div className="flex items-end h-full">
          <button type="submit" className="btn-primary w-full min-w-[100px]">Filter</button>
        </div>
      </form>
      {loading ? (
        <div className="flex items-center justify-center h-64">Loading...</div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {logs.map(log => (
              <tr key={log._id}>
                <td className="px-6 py-4">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-6 py-4">{log.user ? `${log.user.firstName} ${log.user.lastName}` : "-"}</td>
                <td className="px-6 py-4">{log.user?.role}</td>
                <td className="px-6 py-4">{log.action}</td>
                <td className="px-6 py-4 whitespace-pre-line">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AuditLog 