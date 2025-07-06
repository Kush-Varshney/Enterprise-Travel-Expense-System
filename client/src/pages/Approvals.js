import { useState, useEffect, useMemo } from "react"
import { useAuth } from "../contexts/AuthContext"
import axios from "axios"
import toast from "react-hot-toast"
import { Dialog } from "@headlessui/react"

const FILTERS = ["All", "Pending", "Approved", "Rejected"]

// Utility to format date as DD/MM/YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const Approvals = () => {
  const { user } = useAuth()
  const [travelRequests, setTravelRequests] = useState([])
  const [expenseClaims, setExpenseClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("All")
  const [managers, setManagers] = useState([])

  // Modal state
  const [modal, setModal] = useState({ open: false, type: null, request: null })
  const [remarks, setRemarks] = useState("")
  const [selectedManager, setSelectedManager] = useState("")

  useEffect(() => {
    if (user?.role === "Manager" || user?.role === "Admin") {
      fetchApprovals()
      fetchManagers()
    }
  }, [user])

  const fetchApprovals = async () => {
    setLoading(true)
    try {
      const [travelRes, expenseRes] = await Promise.all([
        axios.get("/api/travel"),
        axios.get("/api/expense"),
      ])
      setTravelRequests(travelRes.data.travelRequests.filter(req => req.employee?._id !== user.id))
      setExpenseClaims(expenseRes.data.expenseClaims.filter(claim => claim.employee?._id !== user.id))
    } catch (error) {
      toast.error("Failed to fetch approvals")
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

  // Combine and filter requests
  const combinedRequests = useMemo(() => {
    const travel = travelRequests.map(req => ({
      ...req,
      type: "Travel",
      requestId: req._id,
      submittedBy: req.employee,
      assignedManager: req.employee?.manager,
      dateSubmitted: req.createdAt,
      status: req.status,
    }))
    const expense = expenseClaims.map(claim => ({
      ...claim,
      type: "Expense",
      requestId: claim._id,
      submittedBy: claim.employee,
      assignedManager: claim.employee?.manager,
      dateSubmitted: claim.createdAt,
      status: claim.status,
    }))
    let all = [...travel, ...expense]
    if (filter !== "All") {
      all = all.filter(r => r.status === filter)
    }
    // Sort by date descending
    return all.sort((a, b) => new Date(b.dateSubmitted) - new Date(a.dateSubmitted))
  }, [travelRequests, expenseClaims, filter])

  // Action handlers
  const openModal = (type, request) => {
    setModal({ open: true, type, request })
    setRemarks("")
    setSelectedManager(request?.assignedManager?._id || "")
  }
  const closeModal = () => setModal({ open: false, type: null, request: null })

  const handleReassignManager = async () => {
    if (loading) return;
    if (!selectedManager) {
      toast.error("Please select a manager")
      return
    }
    setLoading(true)
    try {
      await axios.patch(`/api/users/${modal.request.submittedBy._id}`, { manager: selectedManager })
      toast.success("Manager reassigned!")
      closeModal()
      fetchApprovals()
    } catch {
      toast.error("Failed to reassign manager")
    } finally {
      setLoading(false)
    }
  }

  // Add approval handler for Approve/Reject
  const handleApproval = async (status) => {
    if (loading) return;
    setLoading(true);
    try {
      // Determine endpoint based on type
      const endpoint = modal.request?.type === 'Travel'
        ? `/api/travel/${modal.request.requestId}/status`
        : `/api/expense/${modal.request.requestId}/status`;
      await axios.patch(endpoint, {
        status,
        reviewComments: remarks || "",
      });
      toast.success(`${modal.request?.type === 'Travel' ? 'Travel request' : 'Expense claim'} ${status.toLowerCase()} successfully!`);
      closeModal();
      fetchApprovals();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${status.toLowerCase()} request`);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== "Manager" && user?.role !== "Admin") {
    return <div className="p-8 text-center text-red-600">Access denied.</div>
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Approvals</h1>
        <div className="flex space-x-2 mt-4 sm:mt-0">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-md font-medium transition ${
                filter === f
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Request ID</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Submitted By</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Assigned Manager</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date Submitted</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td>
                </tr>
              ) : combinedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">No requests found.</td>
                </tr>
              ) : (
                combinedRequests.map(req => (
                  <tr key={req.requestId} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    <td className="px-4 py-2 font-medium">{req.type}</td>
                    <td className="px-4 py-2">{req.requestId}</td>
                    <td className="px-4 py-2">{req.submittedBy?.firstName} {req.submittedBy?.lastName}</td>
                    <td className="px-4 py-2">{req.assignedManager ? `${req.assignedManager.firstName} ${req.assignedManager.lastName}` : "-"}</td>
                    <td className="px-4 py-2">{formatDate(req.dateSubmitted)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        req.status === "Approved"
                          ? "bg-green-100 text-green-700"
                          : req.status === "Rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 space-x-2">
                      {req.status === "Pending" && (
                        <button
                          className="btn-secondary"
                          onClick={() => openModal("view", req)}
                          disabled={loading}
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      <Dialog open={modal.open && modal.type === 'view'} onClose={closeModal} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <Dialog.Panel className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-auto animate-fade-in" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {modal.request?.type === 'Travel' ? 'Travel Request Details' : 'Expense Claim Details'}
            </h3>
            <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl" aria-label="Close">&times;</button>
          </div>
          <div className="px-6 py-4 space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Employee</label>
                <p className="text-sm text-gray-900 dark:text-white">{modal.request?.submittedBy?.firstName} {modal.request?.submittedBy?.lastName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Department</label>
                <p className="text-sm text-gray-900 dark:text-white">{modal.request?.submittedBy?.department}</p>
              </div>
            </div>
            {/* Details Section */}
            {modal.request?.type === 'Travel' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Destination</label>
                    <p className="text-sm text-gray-900 dark:text-white">{modal.request?.destination}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Purpose</label>
                    <p className="text-sm text-gray-900 dark:text-white">{modal.request?.purpose}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDate(modal.request?.startDate)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDate(modal.request?.endDate)}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Cost</label>
                  <p className="text-sm text-gray-900 dark:text-white">${modal.request?.estimatedCost?.toLocaleString()}</p>
                </div>
                {modal.request?.documentUrl && (
                  <div className="flex flex-col items-center">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Supporting Document</label>
                    <a href={modal.request.documentUrl} target="_blank" rel="noopener noreferrer">
                      <img src={modal.request.documentUrl} alt="Document" className="w-40 h-40 object-cover rounded-lg border shadow" />
                    </a>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Category</label>
                    <p className="text-sm text-gray-900 dark:text-white">{modal.request?.category}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Expense Date</label>
                    <p className="text-sm text-gray-900 dark:text-white">{formatDate(modal.request?.expenseDate)}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Amount</label>
                  <p className="text-sm text-gray-900 dark:text-white">${modal.request?.amount?.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                  <p className="text-sm text-gray-900 dark:text-white">{modal.request?.description}</p>
                </div>
                {modal.request?.receiptUrl && (
                  <div className="flex flex-col items-center">
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Receipt</label>
                    <a href={modal.request.receiptUrl} target="_blank" rel="noopener noreferrer">
                      <img src={modal.request.receiptUrl} alt="Receipt" className="w-40 h-40 object-cover rounded-lg border shadow" />
                    </a>
                  </div>
                )}
              </>
            )}
            {/* Action Area */}
            {modal.request?.status === 'Pending' ? (
              <div className="flex flex-col gap-2 pt-2">
                <textarea
                  className="input-field"
                  style={{ fontSize: 14, minHeight: 32, marginBottom: 4 }}
                  placeholder="Add a comment (optional)"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproval('Approved')}
                    className="btn-primary flex items-center gap-1"
                    style={{ padding: '4px 16px', fontSize: 14, minWidth: 80 }}
                    disabled={loading}
                  >
                    <span>✔</span> Approve
                  </button>
                  <button
                    onClick={() => handleApproval('Rejected')}
                    className="btn-secondary flex items-center gap-1"
                    style={{ padding: '4px 16px', fontSize: 14, minWidth: 80 }}
                    disabled={loading}
                  >
                    <span>✖</span> Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4">
                <span className={`badge ${modal.request?.status === "Approved" ? "badge-approved" : modal.request?.status === "Rejected" ? "badge-rejected" : "badge-pending"}`}>
                  {modal.request?.status === "Approved"
                    ? (modal.request?.type === 'Travel' ? "Request Approved" : "Claim Approved")
                    : modal.request?.status === "Rejected"
                      ? (modal.request?.type === 'Travel' ? "Request Rejected" : "Claim Rejected")
                      : ""}
                </span>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </Dialog>

      {/* Reassign Manager Modal */}
      <Dialog open={modal.open && modal.type === "reassign"} onClose={closeModal} className="fixed z-50 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen px-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-40" />
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 z-50 relative">
            <Dialog.Title className="text-lg font-semibold mb-2">Reassign Manager</Dialog.Title>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Select New Manager</label>
              <select
                className="input-field w-full"
                value={selectedManager}
                onChange={e => setSelectedManager(e.target.value)}
              >
                <option value="">Select a manager...</option>
                {managers.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.firstName} {m.lastName} ({m.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex space-x-2 justify-end">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleReassignManager}
                disabled={loading}
              >
                {loading ? "Processing..." : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default Approvals 