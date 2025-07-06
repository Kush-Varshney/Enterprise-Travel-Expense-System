"use client"

import { useState, useEffect, useRef } from "react"
import { BellIcon, CheckIcon } from "@heroicons/react/24/outline"
import { useAuth } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import axios from "axios"
import toast from "react-hot-toast"
import { io } from "socket.io-client"
import { useNotifications } from "../contexts/NotificationContext"

// Utility to format date as DD/MM/YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const Notifications = () => {
  const { user } = useAuth()
  const { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, setNotifications } = useNotifications()
  const [filter, setFilter] = useState("all")

  // Refetch notifications on mount
  useEffect(() => {
    let isMounted = true
    axios.get("/api/notifications").then(res => {
      if (isMounted && setNotifications) setNotifications(res.data.notifications)
    })
    return () => { isMounted = false }
  }, [setNotifications])

  // Automatically mark all as read when page is visited
  useEffect(() => {
    if (unreadCount > 0 && markAllAsRead) {
      markAllAsRead()
    }
    // Only run when unreadCount changes
  }, [unreadCount, markAllAsRead])

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === "unread") return !notif.isRead
    if (filter === "read") return notif.isRead
    return true
  })

  const getNotificationIcon = (type) => {
    const iconClass = "h-6 w-6"
    switch (type) {
      case "travel_approved":
        return <span className={`${iconClass} text-green-500`}>✈️</span>
      case "travel_rejected":
        return <span className={`${iconClass} text-red-500`}>✈️</span>
      case "expense_approved":
        return <span className={`${iconClass} text-green-500`}>💰</span>
      case "expense_rejected":
        return <span className={`${iconClass} text-red-500`}>💰</span>
      default:
        return <BellIcon className={`${iconClass} text-gray-500`} />
    }
  }

  const getNotificationColor = (type, isRead) => {
    if (isRead) return "bg-gray-50 dark:bg-gray-800"

    switch (type) {
      case "travel_approved":
      case "expense_approved":
        return "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500"
      case "travel_rejected":
      case "expense_rejected":
        return "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500"
      default:
        return "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Stay updated with your travel and expense activities
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="btn-secondary flex items-center">
              <CheckIcon className="h-5 w-5 mr-2" />
              Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 rounded-lg bg-blue-500">
                <BellIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{notifications.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 rounded-lg bg-orange-500">
                <BellIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unread</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{unreadCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 rounded-lg bg-green-500">
                <CheckIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Read</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{notifications.length - unreadCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card">
        <div className="card-body">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {["all", "unread", "read"].map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
                  filter === filterType
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-soft"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                {filterType === "unread" && unreadCount > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card">
        <div className="card-body">
          {loading && notifications.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <span className="loading-spinner-large"></span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No notifications found.</div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredNotifications.map((notification) => (
                <li
                  key={notification._id}
                  className={`p-6 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${getNotificationColor(notification.type, notification.isRead)}`}
                  onClick={() => markAsRead(notification._id)}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-4">{getNotificationIcon(notification.type)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3
                          className={`text-sm font-medium ${
                            notification.isRead ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {formatDate(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsRead(notification._id)
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Mark as read"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p
                        className={`mt-1 text-sm ${
                          notification.isRead ? "text-gray-500 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {notification.message}
                      </p>

                      <div className="mt-2 flex items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(notification.createdAt).toLocaleTimeString()}
                        </span>
                        {!notification.isRead && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default Notifications
