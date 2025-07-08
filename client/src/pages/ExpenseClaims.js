"use client"

import { useState, useEffect, useRef } from "react"
import {
  PlusIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import { useAuth } from "../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import axios from "axios"
import toast from "react-hot-toast"

// Utility to format date as DD/MM/YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Utility to format date+time as DD/MM/YYYY HH:mm
const formatDateTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

const ExpenseClaims = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [claims, setClaims] = useState([])
  const [travelRequests, setTravelRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [filter, setFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    travelRequest: "",
    amount: "",
    description: "",
    expenseDate: "",
    category: "Transportation",
  })
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptError, setReceiptError] = useState(false)
  const [actionComments, setActionComments] = useState({})
  const [viewAll, setViewAll] = useState(user?.role === "Manager")
  const [previewUrl, setPreviewUrl] = useState(null)
  const [receiptImgError, setReceiptImgError] = useState(false)
  const HEADER_HEIGHT = 80;
  const modalRef = useRef();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (user && user.isActive === false) {
      navigate("/pending-approval")
      return null
    }
  }, [user, navigate])

  useEffect(() => {
    fetchExpenseClaims()
    fetchApprovedTravelRequests()
  }, [filter, viewAll])

  useEffect(() => {
    if (selectedClaim) {
      if (modalRef.current) modalRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
    }
  }, [selectedClaim]);

  const fetchExpenseClaims = async () => {
    try {
      setLoading(true)
      const params = { ...(filter !== "all" ? { status: filter } : {}) }
      if (user?.role === "Manager") {
        if (!viewAll) {
          params.employee = user.id
        }
      } else if (user?.role === "Employee") {
        params.employee = user.id
      }
      // Admin sees all claims by default
      const res = await axios.get("/api/expense", { params })
      setClaims(res.data.expenseClaims)
    } catch (error) {
      console.error("Error fetching expense claims:", error)
      toast.error("Failed to fetch expense claims")
    } finally {
      setLoading(false)
    }
  }

  const fetchApprovedTravelRequests = async () => {
    try {
      let params = { status: "Approved" }
      if (user?.role === "Manager" || user?.role === "Employee") {
        params.employee = user.id
      }
      const res = await axios.get("/api/travel", { params })
      setTravelRequests(res.data.travelRequests)
    } catch (error) {
      console.error("Error fetching travel requests:", error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!receiptFile) {
      setReceiptError(true)
      toast.error("Receipt is required. Please upload a receipt to submit your claim.")
      return
    }
    setReceiptError(false)
    try {
      if (loading) return
      setLoading(true)
      const res = await axios.post("/api/expense", formData)
      let newClaim = res.data
      // If a file is selected, upload it
      if (receiptFile) {
        const fileData = new FormData()
        fileData.append("receipt", receiptFile)
        const uploadRes = await axios.post(`/api/expense/${newClaim._id}/receipt`, fileData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        newClaim = uploadRes.data
      }
      setClaims((prev) => [newClaim, ...prev])
      setShowModal(false)
      setFormData({
        travelRequest: "",
        amount: "",
        description: "",
        expenseDate: "",
        category: "Transportation",
      })
      setReceiptFile(null)
      if (user?.role === "Manager") setViewAll(false)
      toast.success("Expense claim submitted successfully!")
    } catch (error) {
      console.error("Error creating expense claim:", error)
      toast.error(error?.response?.data?.message || "Failed to submit expense claim")
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (claimId, status) => {
    try {
      if (loading) return
      setLoading(true)
      await axios.patch(`/api/expense/${claimId}/status`, {
        status,
        reviewComments: actionComments[claimId] || "",
      })
      setActionComments((prev) => ({ ...prev, [claimId]: "" }))
      // Update selectedClaim in state if it's open
      if (selectedClaim && selectedClaim._id === claimId) {
        setSelectedClaim({
          ...selectedClaim,
          ...(user.role === "Manager"
            ? { managerStatus: status }
            : { adminStatus: status }),
          status, // Optionally update the main status
        })
      }
      fetchExpenseClaims()
      if (user?.role === "Admin") setSelectedClaim(null)
      toast.success(`Expense claim ${status.toLowerCase()} successfully!`)
    } catch (error) {
      toast.error("Failed to update expense claim")
    } finally {
      setLoading(false)
    }
  }

  const filteredClaims = claims.filter(
    (claim) =>
      (claim.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.employee?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.employee?.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.travelRequest?.destination.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!dateRange.start || new Date(claim.createdAt) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(claim.createdAt) <= new Date(dateRange.end))
  )

  const canManageClaims = user?.role === "Manager" || user?.role === "Admin"

  const categoryIcons = {
    Transportation: "🚗",
    Accommodation: "🏨",
    Meals: "🍽️",
    Miscellaneous: "📋",
  }

  // Helper to check if a file is an image
  const isImage = (url) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
  const isPDF = (url) => /\.pdf$/i.test(url)

  // Helper to check if claim is fully finalized (both agree)
  const isClaimFinalized = (claim) => (
    claim.adminStatus === "Approved" || claim.adminStatus === "Rejected" ||
    (claim.managerStatus === "Approved" && claim.adminStatus === "Approved") ||
    (claim.managerStatus === "Rejected" && claim.adminStatus === "Rejected")
  )

  const getReceiptUrl = (url) => url?.startsWith("/uploads/") ? url : `/uploads/${url?.replace(/^.*[\\/]/, '')}`

  if (user && user.isActive === false) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expense Claims</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Submit and manage your travel expense claims</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 w-full sm:w-auto mt-4 sm:mt-0 justify-end">
        {(user?.role === "Employee" || user?.role === "Manager") && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center w-full sm:w-auto justify-center mb-2 sm:mb-0">
              <PlusIcon className="h-5 w-5 mr-2" />
              New Claim
            </button>
        )}
        {(user?.role === "Admin" || user?.role === "Manager") && (
            <button
              className={`btn-secondary w-full sm:w-auto ${filteredClaims.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={filteredClaims.length === 0}
              onClick={async () => {
                try {
                  const params = new URLSearchParams();
                  if (filter && filter !== 'all') params.append('status', filter);
                  if (dateRange.start) params.append('start', dateRange.start);
                  if (dateRange.end) params.append('end', dateRange.end);
                  if (searchTerm) params.append('search', searchTerm);
                  const response = await fetch(`/api/expense/export?${params.toString()}`, {
                    method: "GET",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                  });
                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    alert(errorData.message || "Failed to export CSV");
                    return;
                  }
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "expense_claims.csv";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  alert("Export failed: " + err.message);
                }
              }}
            >
              Export CSV
            </button>
          )}
          </div>
      </div>

      {/* View Toggle for Manager only */}
      {user?.role === "Manager" && (
        <div className="flex space-x-2 mb-4">
          <button
            type="button"
            aria-pressed={viewAll}
            className={`btn-secondary${viewAll ? ' border-2 border-primary-600 font-bold' : ''}`}
            onClick={() => setViewAll(true)}
          >
            View All Claims
          </button>
          <button
            type="button"
            aria-pressed={!viewAll}
            className={`btn-secondary${!viewAll ? ' border-2 border-primary-600 font-bold' : ''}`}
            onClick={() => setViewAll(false)}
          >
            My Claims
          </button>
        </div>
      )}

      {/* Heading for Admin only */}
      {user?.role === "Admin" && (
        <div className="mb-4">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">All Claims</span>
        </div>
      )}

      {/* Filters and Search */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <FunnelIcon className="h-5 w-5 text-gray-400 mr-2" />
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field w-auto">
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              {/* Date Range Filter for Admin/Manager */}
              {(user?.role === 'Admin' || user?.role === 'Manager') && (
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">From</label>
                  <div className="relative flex flex-col items-start">
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
                      className="input-field w-auto"
                    />
                    {dateRange.start && (
                      <span className="text-xs text-gray-400 mt-1">{formatDate(dateRange.start)}</span>
                    )}
                  </div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">To</label>
                  <div className="relative flex flex-col items-start">
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
                      className="input-field w-auto"
                    />
                    {dateRange.end && (
                      <span className="text-xs text-gray-400 mt-1">{formatDate(dateRange.end)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search claims..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 w-64"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expense Claims List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="large" />
            </div>
          ) : filteredClaims.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Travel Request
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    {canManageClaims && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Submission Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Receipt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredClaims.map((claim) => (
                    <tr
                      key={claim._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{categoryIcons[claim.category]}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate">
                              {claim.description}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{claim.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{claim.travelRequest?.destination}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{claim.travelRequest?.purpose}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                          <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-2" />${claim.amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {formatDate(claim.expenseDate)}
                        </div>
                      </td>
                      {canManageClaims && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <span>{claim.employee?.firstName} {claim.employee?.lastName}</span>
                            {claim.employee?.role === "Manager" ? (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">💼 Manager</span>
                            ) : (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">👤 Employee</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{claim.employee?.department}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(claim.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {claim.receiptUrl && isImage(claim.receiptUrl) && (
                          <a href={getReceiptUrl(claim.receiptUrl)} target="_blank" rel="noopener noreferrer">
                            <img
                              src={getReceiptUrl(claim.receiptUrl)}
                              alt="Receipt"
                              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #ccc' }}
                              onError={e => { e.target.onerror = null; e.target.src = ''; e.target.alt = 'File not found'; }}
                            />
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`badge ${
                            claim.status === "Approved"
                              ? "badge-approved"
                              : claim.status === "Rejected"
                                ? "badge-rejected"
                                : "badge-pending"
                          }`}
                        >
                          {claim.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedClaim(claim)}
                          style={{ padding: '2px 10px', fontSize: 12 }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No expense claims</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                You have no expense claims yet. Click "New Claim" to get started!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Claim Modal */}
      {(user?.role === "Employee" || user?.role === "Manager") && showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          style={{ paddingTop: 80, paddingBottom: 24 }}
        >
          <div
            className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-auto animate-fade-in"
            style={{
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              padding: 0,
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-t-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Expense Claim</h3>
            </div>
            <form className="px-6 py-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Travel Request
                </label>
                <select
                  required
                  value={formData.travelRequest}
                  onChange={(e) => setFormData({ ...formData, travelRequest: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select a travel request</option>
                  {travelRequests.map((request) => (
                    <option key={request._id} value={request._id}>
                      {request.destination} - {request.purpose}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Enter expense description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field"
                  >
                    <option value="Transportation">Transportation</option>
                    <option value="Accommodation">Accommodation</option>
                    <option value="Meals">Meals</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expense Date</label>
                <input
                  type="date"
                  required
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => { setReceiptFile(e.target.files[0]); setReceiptError(false); }}
                  className={`input-field${receiptError ? ' border-red-500' : ''}`}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-white dark:bg-gray-900 pb-2 z-10">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Claim Modal */}
      {selectedClaim && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          style={{ paddingTop: 80, paddingBottom: 24 }}
        >
          <div
            className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-auto animate-fade-in"
            style={{
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              padding: 0,
            }}
            ref={modalRef}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-t-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Expense Claim Details</h3>
              <button
                onClick={() => setSelectedClaim(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                aria-label="Close"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Amount</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${selectedClaim.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <span
                    className={`badge ${
                      selectedClaim.status === "Approved"
                        ? "badge-approved"
                        : selectedClaim.status === "Rejected"
                          ? "badge-rejected"
                          : "badge-pending"
                    }`}
                  >
                    {selectedClaim.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                <p className="text-sm text-gray-900 dark:text-white">{selectedClaim.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Category</label>
                  <p className="text-sm text-gray-900 dark:text-white flex items-center">
                    <span className="mr-2">{categoryIcons[selectedClaim.category]}</span>
                    {selectedClaim.category}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Expense Date</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedClaim.expenseDate)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Travel Request</label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedClaim.travelRequest?.destination} - {selectedClaim.travelRequest?.purpose}
                </p>
              </div>

              {/* Manager/Admin Approval Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Manager Approval</label>
                  <div className="text-sm text-gray-900 dark:text-white">
                    Status: <span className={`badge ${selectedClaim.managerStatus === "Approved" ? "badge-approved" : selectedClaim.managerStatus === "Rejected" ? "badge-rejected" : "badge-pending"}`}>{selectedClaim.managerStatus}</span>
                  </div>
                  {selectedClaim.managerReviewedBy && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      By: {selectedClaim.managerReviewedBy?.firstName || "Manager"} {selectedClaim.managerReviewedBy?.lastName || ""}
                    </div>
                  )}
                  {selectedClaim.managerReviewComments && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comment: {selectedClaim.managerReviewComments}</div>
                  )}
                  {selectedClaim.managerReviewDate && (
                    <div className="text-xs text-gray-400 mt-1">{formatDateTime(selectedClaim.managerReviewDate)}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Admin Approval</label>
                  <div className="text-sm text-gray-900 dark:text-white">
                    Status: <span className={`badge ${selectedClaim.adminStatus === "Approved" ? "badge-approved" : selectedClaim.adminStatus === "Rejected" ? "badge-rejected" : "badge-pending"}`}>{selectedClaim.adminStatus}</span>
                  </div>
                  {selectedClaim.adminReviewedBy && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      By: {selectedClaim.adminReviewedBy?.firstName || "Admin"} {selectedClaim.adminReviewedBy?.lastName || ""}
                    </div>
                  )}
                  {selectedClaim.adminReviewComments && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comment: {selectedClaim.adminReviewComments}</div>
                  )}
                  {selectedClaim.adminReviewDate && (
                    <div className="text-xs text-gray-400 mt-1">{formatDateTime(selectedClaim.adminReviewDate)}</div>
                  )}
                </div>
              </div>

              {/* Action buttons for hierarchical override */}
              {((user?.role === "Manager" && selectedClaim.managerStatus === "Pending" && !isClaimFinalized(selectedClaim)) ||
                (user?.role === "Admin" && selectedClaim.adminStatus === "Pending" && !isClaimFinalized(selectedClaim))) ? (
                <div className="flex flex-col gap-2 pt-2">
                  <textarea
                    className="input-field"
                    style={{ fontSize: 14, minHeight: 32, marginBottom: 4 }}
                    placeholder="Add a comment (optional)"
                    value={actionComments[selectedClaim._id] || ""}
                    onChange={e => setActionComments((prev) => ({ ...prev, [selectedClaim._id]: e.target.value }))}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedClaim._id, "Approved")}
                      className="btn-primary"
                      style={{ padding: '4px 16px', fontSize: 14, minWidth: 80 }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedClaim._id, "Rejected")}
                      className="btn-secondary"
                      style={{ padding: '4px 16px', fontSize: 14, minWidth: 80 }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-4">
                  <span className={`badge ${selectedClaim.status === "Approved" ? "badge-approved" : selectedClaim.status === "Rejected" ? "badge-rejected" : "badge-pending"}`}>
                    {selectedClaim.status === "Approved"
                      ? "Claim Approved"
                      : selectedClaim.status === "Rejected"
                        ? "Claim Rejected"
                        : ""}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Receipt</label>
                {selectedClaim.receiptUrl ? (
                  isImage(selectedClaim.receiptUrl) ? (
                    <a href={getReceiptUrl(selectedClaim.receiptUrl)} target="_blank" rel="noopener noreferrer">
                      <img
                        src={getReceiptUrl(selectedClaim.receiptUrl)}
                        alt="Receipt"
                        style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }}
                        onError={e => { e.target.onerror = null; e.target.src = ''; e.target.alt = 'File not found'; }}
                      />
                    </a>
                  ) : isPDF(selectedClaim.receiptUrl) ? (
                    <a
                      href={getReceiptUrl(selectedClaim.receiptUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline dark:text-primary-400"
                    >
                      View PDF
                    </a>
                  ) : (
                    <a
                      href={getReceiptUrl(selectedClaim.receiptUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline dark:text-primary-400"
                    >
                      Download Receipt
                    </a>
                  )
                ) : (
                  <span className="text-gray-400">No receipt uploaded</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 animate-fade-in"
          onClick={() => setPreviewUrl(null)}
          style={{ cursor: 'zoom-out' }}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img
              src={previewUrl}
              alt="Receipt Preview"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 2px 16px rgba(0,0,0,0.3)' }}
            />
            <button
              className="absolute top-2 right-2 bg-white bg-opacity-80 rounded-full p-1 shadow hover:bg-opacity-100"
              onClick={() => setPreviewUrl(null)}
              aria-label="Close preview"
              type="button"
            >
              <XMarkIcon className="h-6 w-6 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpenseClaims
