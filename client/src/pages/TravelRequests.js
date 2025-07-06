"use client"

import { useState, useEffect, useRef } from "react"
import {
  PlusIcon,
  MapIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline"
import { useAuth } from "../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import axios from "axios"
import toast from "react-hot-toast"

// Helper to check if a file is an image
const isImage = (url) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
const isPDF = (url) => /\.pdf$/i.test(url)

// Helper to check if request is fully finalized (either admin acted or both agree)
const isRequestFinalized = (request) => (
  request.adminStatus === "Approved" || request.adminStatus === "Rejected" ||
  (request.managerStatus === "Approved" && request.adminStatus === "Approved") ||
  (request.managerStatus === "Rejected" && request.adminStatus === "Rejected")
)

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

const TravelRequests = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [filter, setFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    destination: "",
    purpose: "",
    startDate: "",
    endDate: "",
    estimatedCost: "",
    priority: "Medium",
  })
  const [actionComments, setActionComments] = useState({})
  const [viewAll, setViewAll] = useState(user?.role === "Manager")
  const [dateError, setDateError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [documentFile, setDocumentFile] = useState(null)
  const [documentError, setDocumentError] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const HEADER_HEIGHT = 80;
  const modalRef = useRef();

  useEffect(() => {
    if (user && user.isActive === false) {
      navigate("/pending-approval")
      return null
    }
  }, [user, navigate])

  useEffect(() => {
    fetchTravelRequests()
  }, [filter, viewAll])

  useEffect(() => {
    if (selectedRequest) {
      if (modalRef.current) modalRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
    }
  }, [selectedRequest]);

  const fetchTravelRequests = async () => {
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
      // Admin sees all requests by default
      const res = await axios.get("/api/travel", { params })
      setRequests(res.data.travelRequests)
    } catch (error) {
      console.error("Error fetching travel requests:", error)
      toast.error("Failed to fetch travel requests")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!documentFile) {
      setDocumentError(true)
      toast.error("Supporting document is required. Please upload a document to submit your request.")
      return
    }
    if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      setDateError(true)
      toast.error("End date cannot be before start date. Please correct the date range and try again.", { duration: 4000 })
      return
    }
    setDateError(false)
    setDocumentError(false)
    setSubmitting(true)
    try {
      const res = await axios.post("/api/travel", formData)
      let newRequest = res.data
      if (documentFile) {
        const fileData = new FormData()
        fileData.append("document", documentFile)
        const uploadRes = await axios.post(`/api/travel/${newRequest._id}/document`, fileData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        newRequest = uploadRes.data
      }
      setRequests([newRequest, ...requests])
      setShowModal(false)
      setFormData({
        destination: "",
        purpose: "",
        startDate: "",
        endDate: "",
        estimatedCost: "",
        priority: "Medium",
      })
      setDocumentFile(null)
      if (user?.role === "Manager") setViewAll(false)
      toast.success("Travel request submitted successfully! You will be notified once it's reviewed.")
    } catch (error) {
      console.error("Error creating travel request:", error)
      toast.error(error.response?.data?.message || "Failed to submit travel request")
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusUpdate = async (requestId, status) => {
    try {
      await axios.patch(`/api/travel/${requestId}/status`, {
        status,
        reviewComments: actionComments[requestId] || "",
      })
      setActionComments((prev) => ({ ...prev, [requestId]: "" }))
      // Update selectedRequest in state if it's open
      if (selectedRequest && selectedRequest._id === requestId) {
        setSelectedRequest({
          ...selectedRequest,
          ...(user.role === "Manager"
            ? { managerStatus: status }
            : { adminStatus: status }),
          status, // Optionally update the main status
        })
      }
      fetchTravelRequests()
      toast.success(`Travel request ${status.toLowerCase()} successfully!`)
      setSelectedRequest(null) // Auto-close modal after success
    } catch (error) {
      toast.error("Failed to update travel request")
    }
  }

  const filteredRequests = requests.filter(
    (request) =>
      (request.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.employee?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.employee?.lastName.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!dateRange.start || new Date(request.createdAt) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(request.createdAt) <= new Date(dateRange.end))
  )

  const canManageRequests = user?.role === "Manager" || user?.role === "Admin"

  if (user && user.isActive === false) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Travel Requests</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage your travel requests and approvals</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 w-full sm:w-auto mt-4 sm:mt-0 justify-end">
          {(user?.role === "Employee" || user?.role === "Manager") && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center w-full sm:w-auto justify-center mb-2 sm:mb-0">
              <PlusIcon className="h-5 w-5 mr-2" />
              New Request
            </button>
          )}
          {(user?.role === "Admin" || user?.role === "Manager") && (
            <button
              className={`btn-secondary w-full sm:w-auto ${filteredRequests.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={filteredRequests.length === 0}
              onClick={async () => {
                try {
                  const params = new URLSearchParams();
                  if (filter && filter !== 'all') params.append('status', filter);
                  if (dateRange.start) params.append('start', dateRange.start);
                  if (dateRange.end) params.append('end', dateRange.end);
                  if (searchTerm) params.append('search', searchTerm);
                  const response = await fetch(`/api/travel/export?${params.toString()}`, {
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
                  a.download = "travel_requests.csv";
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
            View All Requests
          </button>
          <button
            type="button"
            aria-pressed={!viewAll}
            className={`btn-secondary${!viewAll ? ' border-2 border-primary-600 font-bold' : ''}`}
            onClick={() => setViewAll(false)}
          >
            My Requests
          </button>
        </div>
      )}

      {/* Heading for Admin only */}
      {user?.role === "Admin" && (
        <div className="mb-4">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">All Requests</span>
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
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 w-64"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Travel Requests List */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="large" />
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Destination
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cost
                    </th>
                    {canManageRequests && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Submission Date
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
                  {filteredRequests.map((request) => (
                    <tr
                      key={request._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapIcon className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {request.destination}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Priority: {request.priority}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">{request.purpose}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          <div>
                            <div>{formatDate(request.startDate)}</div>
                            <div className="text-gray-500 dark:text-gray-400">
                              to {formatDate(request.endDate)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 dark:text-white">
                          <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-2" />$
                          {request.estimatedCost.toLocaleString()}
                        </div>
                      </td>
                      {canManageRequests && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <span>{request.employee?.firstName} {request.employee?.lastName}</span>
                            {request.employee?.role === "Manager" ? (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">💼 Manager</span>
                            ) : (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">👤 Employee</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{request.employee?.department}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(request.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`badge ${
                            request.status === "Approved"
                              ? "badge-approved"
                              : request.status === "Rejected"
                                ? "badge-rejected"
                                : "badge-pending"
                          }`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedRequest(request)}
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
              <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No travel requests</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a new travel request.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Request Modal */}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Travel Request</h3>
            </div>
            <form className="px-6 py-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
                <input
                  type="text"
                  required
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="input-field"
                  placeholder="Enter destination"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose</label>
                <textarea
                  required
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Enter purpose of travel"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => { setFormData({ ...formData, startDate: e.target.value }); setDateError(false); }}
                    className={`input-field${dateError ? ' border-red-500' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => { setFormData({ ...formData, endDate: e.target.value }); setDateError(false); }}
                    className={`input-field${dateError ? ' border-red-500' : ''}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estimated Cost
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.estimatedCost}
                    onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="input-field"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supporting Document</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => { setDocumentFile(e.target.files[0]); setDocumentError(false); }}
                  className={`input-field${documentError ? ' border-red-500' : ''}`}
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

      {/* View Request Modal */}
      {selectedRequest && (
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Travel Request Details</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                aria-label="Close"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Destination</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedRequest.destination}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <span
                    className={`badge ${
                      selectedRequest.status === "Approved"
                        ? "badge-approved"
                        : selectedRequest.status === "Rejected"
                          ? "badge-rejected"
                          : "badge-pending"
                    }`}
                  >
                    {selectedRequest.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Purpose</label>
                <p className="text-sm text-gray-900 dark:text-white">{selectedRequest.purpose}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Start Date</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedRequest.startDate)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">End Date</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(selectedRequest.endDate)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Cost</label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    ${selectedRequest.estimatedCost.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Priority</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedRequest.priority}</p>
                </div>
              </div>

              {/* Manager/Admin Approval Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Manager Approval</label>
                  <div className="text-sm text-gray-900 dark:text-white">
                    Status: <span className={`badge ${selectedRequest.managerStatus === "Approved" ? "badge-approved" : selectedRequest.managerStatus === "Rejected" ? "badge-rejected" : "badge-pending"}`}>{selectedRequest.managerStatus}</span>
                  </div>
                  {selectedRequest.managerReviewedBy && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      By: {selectedRequest.managerReviewedBy?.firstName || "Manager"} {selectedRequest.managerReviewedBy?.lastName || ""}
                    </div>
                  )}
                  {selectedRequest.managerReviewComments && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comment: {selectedRequest.managerReviewComments}</div>
                  )}
                  {selectedRequest.managerReviewDate && (
                    <div className="text-xs text-gray-400 mt-1">{formatDateTime(selectedRequest.managerReviewDate)}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Admin Approval</label>
                  <div className="text-sm text-gray-900 dark:text-white">
                    Status: <span className={`badge ${selectedRequest.adminStatus === "Approved" ? "badge-approved" : selectedRequest.adminStatus === "Rejected" ? "badge-rejected" : "badge-pending"}`}>{selectedRequest.adminStatus}</span>
                  </div>
                  {selectedRequest.adminReviewedBy && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      By: {selectedRequest.adminReviewedBy?.firstName || "Admin"} {selectedRequest.adminReviewedBy?.lastName || ""}
                    </div>
                  )}
                  {selectedRequest.adminReviewComments && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comment: {selectedRequest.adminReviewComments}</div>
                  )}
                  {selectedRequest.adminReviewDate && (
                    <div className="text-xs text-gray-400 mt-1">{formatDateTime(selectedRequest.adminReviewDate)}</div>
                  )}
                </div>
              </div>

              {/* Action buttons for hierarchical override */}
              {((user?.role === "Manager" && selectedRequest.managerStatus === "Pending" && !isRequestFinalized(selectedRequest) && selectedRequest.employee?._id?.toString() !== user.id?.toString()) ||
                (user?.role === "Admin" && selectedRequest.adminStatus === "Pending" && !isRequestFinalized(selectedRequest))) ? (
                <div className="flex flex-col gap-2 pt-2">
                  <textarea
                    className="input-field"
                    placeholder="Add a comment (optional)"
                    value={actionComments[selectedRequest._id] || ""}
                    onChange={e => setActionComments((prev) => ({ ...prev, [selectedRequest._id]: e.target.value }))}
                    rows={3}
                    style={{ minHeight: 100, resize: 'vertical', fontSize: 14, marginBottom: 4 }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedRequest._id, "Approved")}
                      className="btn-primary"
                      style={{ padding: '4px 16px', fontSize: 14, minWidth: 80 }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedRequest._id, "Rejected")}
                      className="btn-secondary"
                      style={{ padding: '4px 16px', fontSize: 14, minWidth: 80 }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-4">
                  <span className={`badge ${selectedRequest.status === "Approved" ? "badge-approved" : selectedRequest.status === "Rejected" ? "badge-rejected" : "badge-pending"}`}>
                    {selectedRequest.status === "Approved"
                      ? "Request Approved"
                      : selectedRequest.status === "Rejected"
                        ? "Request Rejected"
                        : ""}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Supporting Document</label>
                {selectedRequest.documentUrl ? (
                  isImage(selectedRequest.documentUrl) ? (
                    <a href={selectedRequest.documentUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={selectedRequest.documentUrl}
                        alt="Document"
                        style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc' }}
                        onError={e => { e.target.onerror = null; e.target.src = ''; e.target.alt = 'File not found'; }}
                      />
                    </a>
                  ) : isPDF(selectedRequest.documentUrl) ? (
                    <a
                      href={selectedRequest.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline dark:text-primary-400"
                    >
                      View PDF
                    </a>
                  ) : (
                    <a
                      href={selectedRequest.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline dark:text-primary-400"
                    >
                      Download Document
                    </a>
                  )
                ) : (
                  <span className="text-gray-400">No document uploaded</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TravelRequests
