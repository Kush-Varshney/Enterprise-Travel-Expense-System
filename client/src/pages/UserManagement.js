import { useState, useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import axios from "axios"
import { toast } from "react-hot-toast"
import { UserCircleIcon, MagnifyingGlassIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline"
import { Menu } from "@headlessui/react"
import { ChevronDownIcon } from "@heroicons/react/24/outline"
import { Dialog } from '@headlessui/react'
import { PencilIcon, TrashIcon, UserGroupIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

const UserManagement = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "Employee",
    department: "General",
    manager: "",
    isActive: true,
  })
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionUser, setActionUser] = useState(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [assigningManager, setAssigningManager] = useState(false)

  useEffect(() => {
    if (user?.role === "Admin") {
      fetchUsers()
      fetchManagers()
    }
  }, [user])

  const fetchUsers = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await axios.get("/api/users")
      setUsers(res.data.users)
    } catch (err) {
      setError("Failed to fetch users")
    } finally {
      setLoading(false)
    }
  }

  const fetchManagers = async () => {
    try {
      const res = await axios.get("/api/users")
      setManagers(res.data.users.filter(u => u.role === "Manager" && u.isActive))
    } catch (err) {
      // ignore
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (loading) return;
    setCreating(true)
    try {
      const payload = { ...newUser, manager: newUser.manager || undefined }
      await axios.post("/api/users", payload)
      toast.success("User created successfully. Credentials sent to the registered email.")
      setShowCreate(false)
      setNewUser({ email: "", password: "", firstName: "", lastName: "", role: "Employee", department: "General", manager: "", isActive: true })
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateUser = async (id, updates) => {
    if (assigningManager) return;
    if (updates.manager !== undefined) setAssigningManager(true);
    setUpdatingId(id);
    try {
      const payload = { ...updates, manager: updates.manager === "" ? undefined : updates.manager };
      await axios.patch(`/api/users/${id}`, payload);
      if (updates.hasOwnProperty('manager')) {
        toast.success(updates.manager === undefined || updates.manager === "" ? "Manager unassigned successfully!" : "Manager assigned successfully!");
      } else if (updates.hasOwnProperty('isActive')) {
        toast.success(updates.isActive ? "User activated!" : "User deactivated!");
      } else {
        toast.success("User updated!");
      }
      await fetchUsers();
      await fetchManagers();
      setShowActionModal(false);
      setActionUser(null);
    } catch (err) {
      if (
        err.response &&
        err.response.status === 403 &&
        err.response.data &&
        err.response.data.message &&
        updates.hasOwnProperty('isActive')
      ) {
        toast.error('Only the Super Admin can Deactivate Admins or Super Admins.');
      } else if (err.response && err.response.status === 403 && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message || 'Only the Super Admin can modify or delete Admins or Super Admins.');
      } else {
        toast.error(err.response?.data?.message || "Failed to update user");
      }
    } finally {
      if (updates.manager !== undefined) setAssigningManager(false);
      setUpdatingId(null);
    }
  };

  const getPasswordStrength = (password) => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    if (score <= 2) return { label: "Weak", color: "bg-red-500" }
    if (score === 3 || score === 4) return { label: "Medium", color: "bg-yellow-500" }
    return { label: "Strong", color: "bg-green-500" }
  }

  const getRoleBadge = (role, isPermanent) => {
    if (isPermanent) return <span className="badge badge-superadmin" title="Super Admin">👑 Super Admin</span>;
    if (role === "Admin") return <span className="badge badge-admin" title="Admin">��️ Admin</span>;
    if (role === "Manager") return <span className="badge badge-manager" title="Manager">💼 Manager</span>;
    return <span className="badge badge-employee" title="Employee">👤 Employee</span>;
  };

  const filteredUsers = users.filter(u =>
    u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@#$!";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`/api/users/${userId}`);
      fetchUsers();
      setShowActionModal(false);
      toast.success('User deleted');
    } catch (err) {
      if (err.response && err.response.status === 403 && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message || 'Only the Super Admin can modify or delete Admins or Super Admins.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to delete user');
      }
    }
  };

  if (user?.role !== "Admin") {
    return <div className="p-8 text-center text-red-600">Access denied.</div>
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>Create User</button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center mb-4">
        <div className="relative w-full max-w-xs">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-strong max-w-lg w-full p-8">
            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white text-center">Create New User</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input type="text" className="input-field w-full" required value={newUser.firstName} onChange={e => setNewUser({ ...newUser, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input type="text" className="input-field w-full" required value={newUser.lastName} onChange={e => setNewUser({ ...newUser, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input-field w-full" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select className="input-field w-full" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="Employee">Employee</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select className="input-field w-full" value={newUser.isActive ? 'Active' : 'Inactive'} onChange={e => setNewUser({ ...newUser, isActive: e.target.value === 'Active' })}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <div className="flex items-center gap-2">
                    <input type="password" className="input-field w-full" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                    <button type="button" className="btn-secondary btn-xs whitespace-nowrap" onClick={() => setNewUser({ ...newUser, password: generatePassword() })}>Generate</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <input type="text" className="input-field w-full" value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} />
                </div>
              </div>
                <div>
                <label className="block text-sm font-medium mb-1">Manager <span className="text-xs text-gray-400">(Only for Employees)</span></label>
                <select className="input-field w-full" value={newUser.manager} onChange={e => setNewUser({ ...newUser, manager: e.target.value })} disabled={newUser.role !== "Employee"}>
                    <option value="">None</option>
                    {managers.map(m => (
                      <option key={m._id} value={m._id}>{m.firstName} {m.lastName} ({m.email})</option>
                    ))}
                  </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Creating..." : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User List - Split by Role */}
      <div className="space-y-8">
        {/* Employees Table */}
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-2">Employees</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Department</th>
                    <th className="px-6 py-3">Manager</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.filter(u => u.role === "Employee").map((u) => {
                    const isSelf = user.email === u.email;
                    return (
                      <tr key={u._id}>
                        <td className="px-6 py-4 flex items-center space-x-3">
                          {u.profilePicture ? (
                            <img src={u.profilePicture} alt="avatar" className="h-10 w-10 rounded-full object-cover border" />
                          ) : (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-lg">
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </span>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{u.email}</td>
                        <td className="px-6 py-4">{getRoleBadge(u.role, u.isPermanent)}</td>
                        <td className="px-6 py-4">{u.department}</td>
                        <td className="px-6 py-4">{u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : <span className="text-gray-400">None</span>}</td>
                        <td className="px-6 py-4">
                          {u.isActive ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                              <CheckCircleIcon className="h-4 w-4 mr-1" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                              <XCircleIcon className="h-4 w-4 mr-1" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            className={`btn-secondary flex items-center w-full justify-center ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => { if (!isSelf) { setActionUser(u); setShowActionModal(true); } }}
                            disabled={isSelf}
                            title={isSelf ? "You cannot modify your own account" : "Manage user"}
                          >
                            Actions <ChevronDownIcon className="h-4 w-4 ml-1" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Managers Table */}
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-2">Managers</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Department</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.filter(u => u.role === "Manager").map((u) => {
                    const isSelf = user.email === u.email;
                    return (
                      <tr key={u._id}>
                        <td className="px-6 py-4 flex items-center space-x-3">
                          {u.profilePicture ? (
                            <img src={u.profilePicture} alt="avatar" className="h-10 w-10 rounded-full object-cover border" />
                          ) : (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-lg">
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </span>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{u.email}</td>
                        <td className="px-6 py-4">{getRoleBadge(u.role, u.isPermanent)}</td>
                        <td className="px-6 py-4">{u.department}</td>
                        <td className="px-6 py-4">
                          {u.isActive ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                              <CheckCircleIcon className="h-4 w-4 mr-1" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                              <XCircleIcon className="h-4 w-4 mr-1" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            className={`btn-secondary flex items-center w-full justify-center ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => { if (!isSelf) { setActionUser(u); setShowActionModal(true); } }}
                            disabled={isSelf}
                            title={isSelf ? "You cannot modify your own account" : "Manage user"}
                          >
                            Actions <ChevronDownIcon className="h-4 w-4 ml-1" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Admins Table */}
        <div className="card">
          <div className="card-body">
            <h2 className="text-lg font-semibold mb-2">Admins</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Department</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.filter(u => u.role === "Admin").map((u) => {
                    const isSelf = user.email === u.email;
                    return (
                      <tr key={u._id}>
                        <td className="px-6 py-4 flex items-center space-x-3">
                          {u.profilePicture ? (
                            <img src={u.profilePicture} alt="avatar" className="h-10 w-10 rounded-full object-cover border" />
                          ) : (
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-lg">
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </span>
                          )}
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{u.email}</td>
                        <td className="px-6 py-4">{getRoleBadge(u.role, u.isPermanent)}</td>
                        <td className="px-6 py-4">{u.department}</td>
                        <td className="px-6 py-4">
                          {u.isActive ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                              <CheckCircleIcon className="h-4 w-4 mr-1" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                              <XCircleIcon className="h-4 w-4 mr-1" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            className={`btn-secondary flex items-center w-full justify-center ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => { if (!isSelf) { setActionUser(u); setShowActionModal(true); } }}
                            disabled={isSelf}
                            title={isSelf ? "You cannot modify your own account" : "Manage user"}
                          >
                            Actions <ChevronDownIcon className="h-4 w-4 ml-1" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Action Modal */}
      <Dialog open={showActionModal} onClose={() => setShowActionModal(false)} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-40" />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 z-10">
            <Dialog.Title className="text-lg font-bold mb-4 flex items-center gap-2">
              <UserGroupIcon className="h-6 w-6 text-primary-600" /> Manage User
            </Dialog.Title>
            {actionUser && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Role</label>
                  <select
                    value={actionUser.role}
                    onChange={e => handleUpdateUser(actionUser._id, { role: e.target.value })}
                    className="input-field w-full"
                    disabled={user._id === actionUser._id || actionUser.isPermanent}
                  >
                    <option value="Employee">Employee</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Manager</label>
                  <select
                    value={actionUser.manager?._id || ""}
                    onChange={e => handleUpdateUser(actionUser._id, { manager: e.target.value === "" ? null : e.target.value })}
                    className="input-field w-full"
                    disabled={actionUser.role !== "Employee" || user._id === actionUser._id || actionUser.isPermanent || assigningManager}
                  >
                    <option value="">None</option>
                    {managers.map(m => (
                      <option key={m._id} value={m._id}>{m.firstName} {m.lastName} ({m.email})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Status:</span>
                  {actionUser.isPermanent ? (
                    <span className="text-gray-400 ml-2" title="Super Admin can't be deactivated">🛡️ Super Admin can't be deactivated</span>
                  ) : (
                    <button
                      className={`btn-secondary ${!actionUser.isActive ? "opacity-50" : ""}`}
                      onClick={() => handleUpdateUser(actionUser._id, { isActive: !actionUser.isActive })}
                      disabled={user._id === actionUser._id || actionUser.isPermanent}
                      title={user._id === actionUser._id ? "You can't deactivate yourself." : actionUser.isPermanent ? "Super Admin can't be deactivated." : "Deactivate user"}
                    >
                      {actionUser.isActive ? <XCircleIcon className="h-4 w-4 mr-1" /> : <CheckCircleIcon className="h-4 w-4 mr-1" />}
                      {actionUser.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
                <div className="flex justify-between mt-6">
                  <button className="btn-secondary" onClick={() => setShowActionModal(false)}>Cancel</button>
                  {!actionUser.isPermanent && (
                    <button
                      className="btn-danger flex items-center"
                      onClick={async () => { await handleDeleteUser(actionUser._id); }}
                      disabled={user._id === actionUser._id}
                      title={user._id === actionUser._id ? "You can't delete yourself." : "Delete user"}
                    >
                      <TrashIcon className="h-4 w-4 mr-1" /> Delete User
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default UserManagement 