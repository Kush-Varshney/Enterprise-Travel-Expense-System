"use client"

import { useState, useRef, useEffect } from "react"
import { UserCircleIcon, PencilIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { useAuth } from "../contexts/AuthContext"
import toast from "react-hot-toast"
import axios from "axios"
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '../utils/cropImage'

const Profile = () => {
  const { user, loadUser, updateUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    department: user?.department || "",
    currentPassword: "",
    newPassword: "",
  })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "" })
  const [changingPassword, setChangingPassword] = useState(false)
  const fileInputRef = useRef()
  const [uploadingPic, setUploadingPic] = useState(false)
  const [stats, setStats] = useState({
    travelRequests: 0,
    expenseClaims: 0,
    totalExpenses: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)
  const [previewPic, setPreviewPic] = useState(null)
  const [uploadError, setUploadError] = useState("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true)
      setStatsError(null)
      try {
        const [travelRes, expenseRes] = await Promise.all([
          axios.get("/api/travel", { params: { employee: user.id } }),
          axios.get("/api/expense", { params: { employee: user.id } }),
        ])
        setStats({
          travelRequests: travelRes.data.travelRequests.length,
          expenseClaims: expenseRes.data.expenseClaims.length,
          totalExpenses: expenseRes.data.expenseClaims.reduce((sum, claim) => sum + (claim.amount || 0), 0),
        })
      } catch (err) {
        setStatsError("Failed to load statistics")
      } finally {
        setStatsLoading(false)
      }
    }
    if (user?.id) fetchStats()
  }, [user?.id])

  const handleEdit = () => {
    setIsEditing(true)
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      department: user?.department || "",
      currentPassword: "",
      newPassword: "",
    })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      department: user?.department || "",
      currentPassword: "",
      newPassword: "",
    })
  }

  const handleSave = async () => {
    try {
      await axios.patch("/api/auth/profile", formData)
      toast.success("Profile updated successfully!")
      setIsEditing(false)
      await loadUser()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile")
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setChangingPassword(true)
    try {
      await axios.post("/api/auth/change-password", passwordData)
      toast.success("Password changed successfully!")
      setPasswordData({ currentPassword: "", newPassword: "" })
      setShowPasswordForm(false)
      await loadUser()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleProfilePicChange = async (e) => {
    setUploadError("")
    const file = e.target.files[0]
    if (!file) return
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"]
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Only JPG and PNG images are allowed.")
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      return
    }
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be 5MB or less.")
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      return
    }
    // Show preview and cropper
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewPic(reader.result)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleSaveCroppedImage = async () => {
    setUploadingPic(true)
    setUploadError("")
    try {
      const croppedImage = await getCroppedImg(previewPic, croppedAreaPixels)
      const blob = await fetch(croppedImage).then(r => r.blob())
      const formData = new FormData()
      formData.append("profilePicture", blob, "cropped.jpg")
      const res = await axios.post(`/api/users/${user.id}/profile-picture`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      toast.success("Profile picture updated!")
      if (res.data.profilePicture) {
        updateUser({ 
          profilePicture: res.data.profilePicture, 
          profilePicturePublicId: res.data.profilePicturePublicId 
        })
      }
      setPreviewPic(null)
      setShowCropper(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch {
      setUploadError("Failed to upload profile picture")
      toast.error("Failed to upload profile picture")
    } finally {
      setUploadingPic(false)
    }
  }

  const handleRemoveProfilePic = async () => {
    setShowDeleteModal(false)
    setUploadingPic(true)
    setUploadError("")
    try {
      const res = await axios.delete(`/api/users/${user.id}/profile-picture`)
      toast.success('Profile picture removed')
      // Update user state with undefined values to clear the profile picture
      updateUser({ profilePicture: undefined, profilePicturePublicId: undefined })
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      toast.error('Failed to remove profile picture')
    } finally {
      setUploadingPic(false)
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "Admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "Manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "Employee":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "Never"
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage your account information</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Information</h3>
            {!isEditing ? (
              <button onClick={handleEdit} className="btn-secondary flex items-center">
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </button>
            ) : (
              <div className="flex space-x-2">
                <button onClick={handleSave} className="btn-success flex items-center">
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Save
                </button>
                <button onClick={handleCancel} className="btn-secondary flex items-center">
                  <XMarkIcon className="h-4 w-4 mr-2" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card-body">
          <div className="flex items-center space-x-6 mb-8">
            {/* Profile Picture Section */}
            <div className="flex-shrink-0 relative group">
              {previewPic ? (
                <img
                  src={previewPic}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-4 border-primary-500 shadow-strong opacity-80"
                />
              ) : user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-4 border-primary-500 shadow-strong"
                  onError={e => { e.target.onerror = null; e.target.src = ''; }}
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-strong">
                  <UserCircleIcon className="w-12 h-12 text-white" />
                </div>
              )}
              <button
                type="button"
                className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-2 shadow-lg opacity-80 hover:opacity-100 transition"
                onClick={() => fileInputRef.current.click()}
                disabled={uploadingPic}
                title={user?.profilePicture ? "Change profile picture" : "Add profile picture"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6 6M9 13l-6 6m6-6l6-6" /></svg>
              </button>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                ref={fileInputRef}
                className="hidden"
                onChange={handleProfilePicChange}
                disabled={uploadingPic}
              />
              {/* Add/Remove Profile Picture UI */}
              {!user?.profilePicture ? (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">Add Profile Picture</div>
              ) : (
                <button
                  type="button"
                  className="mt-2 text-xs text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-200 block mx-auto"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={uploadingPic}
                >
                  Remove Profile Picture
                </button>
              )}
              {uploadingPic && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60 rounded-full">
                  <span className="loading-spinner"></span>
                </div>
              )}
              {uploadError && (
                <div className="absolute left-0 right-0 -bottom-8 text-xs text-red-500 text-center">{uploadError}</div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">@{user?.email}</p>
              <div className="mt-2">
                <span className={`badge ${getRoleBadgeColor(user?.role)}`}>{user?.role}</span>
              </div>
            </div>
          </div>

          <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={e => { e.preventDefault(); handleSave(); }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input-field"
                />
              ) : (
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                  {user?.firstName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
              {isEditing ? (
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input-field"
                />
              ) : (
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                  {user?.lastName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
              <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
              <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                {user?.role}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Role is managed by administrators</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Department</label>
              {isEditing ? (
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="input-field"
                />
              ) : (
                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                  {user?.department}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Account Statistics</h3>
        </div>
        <div className="card-body">
          {statsLoading ? (
            <div className="flex justify-center items-center py-8">
              <span className="loading-spinner-large"></span>
            </div>
          ) : statsError ? (
            <div className="text-center text-red-500 py-8">{statsError}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{stats.travelRequests}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Travel Requests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.expenseClaims}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Expense Claims</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">${stats.totalExpenses.toLocaleString()}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security</h3>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Password</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last updated: {formatDate(user?.passwordUpdatedAt)}</p>
              </div>
              <button className="btn-secondary" onClick={() => setShowPasswordForm(true)}>Change Password</button>
            </div>
            {showPasswordForm && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="input-field"
                      required
                      minLength={6}
                    />
                  </div>
                  {passwordData.newPassword && (
                    <div className="mt-2 flex items-center space-x-2">
                      <div className={`h-2 w-24 rounded ${getPasswordStrength(passwordData.newPassword).color}`}></div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{getPasswordStrength(passwordData.newPassword).label}</span>
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <button type="submit" className="btn-primary" disabled={changingPassword}>
                      {changingPassword ? "Changing..." : "Change Password"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowPasswordForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Account Status</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your account is active</p>
              </div>
              <span className="badge badge-approved">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cropper Modal */}
      {showCropper && previewPic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-xs sm:max-w-md mx-4 flex flex-col items-center relative">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Crop Profile Picture</h2>
            <div className="w-56 h-56 sm:w-64 sm:h-64 relative">
              <Cropper
                image={previewPic}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>
            <div className="flex justify-between items-center w-full mt-6 gap-4">
              <button className="btn-secondary flex-1" onClick={() => { 
                setShowCropper(false); 
                setPreviewPic(null); 
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setCroppedAreaPixels(null);
                // Reset file input
                if (fileInputRef.current) {
                  fileInputRef.current.value = ""
                }
              }}>Cancel</button>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="mx-2 flex-1" />
              <button className="btn-primary flex-1" onClick={handleSaveCroppedImage} disabled={uploadingPic}>{uploadingPic ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete Profile Picture
                </h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete your profile picture? This action cannot be undone.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 transition-colors"
                onClick={handleRemoveProfilePic}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
