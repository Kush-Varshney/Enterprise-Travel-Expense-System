import { createContext, useContext, useEffect, useRef, useState } from "react"
import axios from "axios"
import { io } from "socket.io-client"
import toast from "react-hot-toast"
import { useAuth } from "./AuthContext"

const NotificationContext = createContext()

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const socketRef = useRef(null)

  // Fetch notifications on mount
  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    axios.get("/api/notifications")
      .then(res => {
        setNotifications(res.data.notifications)
        setLoading(false)
      })
      .catch(err => {
        setError("Failed to load notifications")
        setLoading(false)
      })
  }, [user?.id])

  // Setup Socket.IO for real-time updates
  useEffect(() => {
    if (!user?.id) return
    if (!socketRef.current) {
      socketRef.current = io(process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000", {
        withCredentials: true,
      })
      socketRef.current.on("connect", () => {
        socketRef.current.emit("register", user.id)
      })
      socketRef.current.on("notification", (notif) => {
        setNotifications(prev => [notif, ...prev])
        toast.success("You have a new notification!", { id: notif._id })
      })
    } else {
      socketRef.current.emit("register", user.id)
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [user?.id])

  // Mark as read
  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`/api/notifications/${notificationId}/read`)
      setNotifications(
        notifications.map((notif) => (notif._id === notificationId ? { ...notif, isRead: true } : notif))
      )
    } catch (error) {
      toast.error("Failed to mark notification as read")
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.patch("/api/notifications/read-all")
      setNotifications(notifications.map((notif) => ({ ...notif, isRead: true })))
    } catch (error) {
      toast.error("Failed to mark all notifications as read")
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, error, markAsRead, markAllAsRead, setNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) throw new Error("useNotifications must be used within a NotificationProvider")
  return context
} 