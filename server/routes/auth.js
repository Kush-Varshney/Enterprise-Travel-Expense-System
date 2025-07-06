const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const { auth } = require("../middleware/auth")
const crypto = require('crypto')
const sendEmail = require('../utils/sendEmail')
const rateLimit = require('express-rate-limit')
const dayjs = require('dayjs')

const router = express.Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
})
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per 15 minutes
  message: "Too many registration attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
})

// Register
router.post(
  "/register",
  registerLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password, firstName, lastName, department } = req.body

      // Check if user exists
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" })
      }

      // Create user
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        department,
        role: "Employee",
        isActive: false,
      })

      await user.save()

      // After user.save(), notify all admins of any new user registration (any role)
      const now = dayjs().format('DD-MM-YYYY HH:mm:ss')
      const admins = await User.find({ role: "Admin", isActive: true })
      if (admins.length > 0) {
        // Send email to each admin, fire-and-forget
        for (const admin of admins) {
          sendEmail({
            to: admin.email,
            subject: "New User Registration Pending Approval",
            body: `
              <p style='font-size:1.1em;'>A new user has registered and is awaiting your approval:</p>
              <ul style='margin:16px 0 24px 24px; font-size:1em;'>
                <li><strong>Name:</strong> ${user.firstName} ${user.lastName}</li>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Role:</strong> ${user.role}</li>
                <li><strong>Registered on:</strong> <span style='color:#6366f1;'>${now}</span></li>
              </ul>
              <p style='margin-top:16px;'>Please review and approve or reject this registration in the admin panel.</p>
              <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${now}</div>
            `
          }).catch(err => console.error('Email failed:', err))
        }
        // In-app notification for all admins
        const Notification = require('../models/Notification')
        Notification.insertMany(admins.map(admin => ({
          recipient: admin._id,
          title: "New User Registration",
          message: "A new user has registered and is awaiting approval.",
          type: "user_pending_approval",
          relatedId: user._id,
          relatedModel: "User",
        }))).catch(err => console.error('Notification insertMany failed:', err))
        // Emit real-time notification to connected admins
        const io = req.app.get('io')
        const connectedUsers = req.app.get('connectedUsers')
        admins.forEach((admin, i) => {
          const socketId = connectedUsers[admin._id.toString()]
          if (socketId) io.to(socketId).emit('notification', notifDocs[i]).catch(err => console.error('Socket emit failed:', err))
        })
      }

      // Send welcome email to user (with password and role)
      await sendEmail({
        to: user.email,
        subject: `🎉 Welcome to Travel & Expense Management – Employee Access Pending Approval`,
        body: `
          <h2>Welcome Aboard!</h2>
          <p>Your account has been created with the following credentials:</p>
          <ul>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Password:</strong> ${password}</li>
            <li><strong>Role:</strong> Employee</li>
          </ul>
          <p>Your account is currently <span style='color:#f59e42; font-weight:bold;'>pending admin approval</span>.</p>
          <p>Please login and change your password after first use for security. You will receive an email as soon as your account is approved.</p>
          <ul style='margin:16px 0 24px 24px; font-size:1em;'>
            <li><strong>Registered on:</strong> <span style='color:#6366f1;'>${now}</span></li>
          </ul>
        `
      }).catch(err => console.error('Email failed:', err))

      // Generate JWT
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })

      res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          department: user.department,
        },
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Login
router.post(
  "/login",
  loginLimiter,
  [
    body("email").notEmpty().withMessage("Email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password } = req.body

      // Find user
      const user = await User.findOne({ email })
      if (!user || !user.isActive) {
        return res.status(403).json({ message: user && !user.isActive ? "Your account is pending admin approval." : "Invalid credentials" })
      }

      // Check password
      const isMatch = await user.comparePassword(password)
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" })
      }

      // Generate JWT
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" })

      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          department: user.department,
        },
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Get current user
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id)
  res.json({
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
      passwordUpdatedAt: user.passwordUpdatedAt,
    },
  })
})

// Change password (separate endpoint)
router.post("/change-password", auth, [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: "User not found" })
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" })
    }
    user.password = newPassword
    await user.save()
    res.json({ message: "Password changed successfully" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Profile update (no password change)
router.patch("/profile", auth, async (req, res) => {
  try {
    const { firstName, lastName, department } = req.body
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: "User not found" })
    if (firstName) user.firstName = firstName
    if (lastName) user.lastName = lastName
    if (department) user.department = department
    await user.save()
    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        passwordUpdatedAt: user.passwordUpdatedAt,
      },
      message: "Profile updated successfully",
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ message: 'Email is required' })
  const user = await User.findOne({ email })
  if (!user) return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' })
  const token = crypto.randomBytes(32).toString('hex')
  user.resetPasswordToken = token
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 60 // 1 hour
  await user.save()
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${token}`
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    body: `Click the link below to reset your password:<br/><a href="${resetUrl}">${resetUrl}</a><br/><br/>If you did not request this, you can ignore this email.`
  }).catch(err => console.error('Email failed:', err))
  res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' })
})

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ message: 'Invalid request' })
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  })
  if (!user) return res.status(400).json({ message: 'Invalid or expired token' })
  user.password = password
  user.resetPasswordToken = undefined
  user.resetPasswordExpires = undefined
  await user.save()
  res.status(200).json({ message: 'Password has been reset. You can now log in.' })
})

module.exports = router
