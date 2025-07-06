const express = require("express")
const Notification = require("../models/Notification")
const { auth } = require("../middleware/auth")

const router = express.Router()

// Get user notifications
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    })

    res.json({
      notifications,
      unreadCount,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Mark notification as read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true },
    )

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    res.json(notification)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Mark all notifications as read
router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true })

    res.json({ message: "All notifications marked as read" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
