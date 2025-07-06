const express = require("express")
const { auth, authorize } = require("../middleware/auth")
const User = require("../models/User")
const AuditLog = require("../models/AuditLog")
const multer = require("multer")
const path = require("path")
const sendEmail = require('../utils/sendEmail')
const dayjs = require('dayjs')

const router = express.Router()

// List all users (Admin only)
router.get("/", auth, authorize("Admin"), async (req, res) => {
  try {
    const { status, page = 0, limit = 20 } = req.query;
    const query = {};
    if (status === "pending") {
      query.isActive = false;
    } else if (status === "active") {
      query.isActive = true;
    }
    const users = await User.find(query)
      .select("-password")
      .populate("manager", "firstName lastName email role")
      .limit(Number(limit))
      .skip(Number(page) * Number(limit));
    const total = await User.countDocuments(query);
    res.json({ users, total });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
})

// Update user role, status, or manager (Admin only)
router.patch("/:id", auth, authorize("Admin"), async (req, res) => {
  try {
    const { role, isActive, manager } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: "User not found" })
    // Block self-modification for role/status/manager
    if (req.user._id.toString() === user._id.toString() && (role || typeof isActive === "boolean" || manager !== undefined)) {
      return res.status(403).json({ message: "You cannot change your own role, status, or manager." })
    }
    // Prevent any changes to the super admin by anyone
    if (user.isPermanent && (role || typeof isActive === "boolean" || manager)) {
      return res.status(403).json({ message: "Cannot modify permanent admin account" })
    }
    // Only the super admin can change the role of other admins
    if (
      role === "Admin" &&
      (!req.user.isPermanent || req.user._id.toString() === user._id.toString())
    ) {
      return res.status(403).json({ message: "Only the super admin can assign or modify admin roles." })
    }
    // Prevent non-super-admins from changing the role of any admin
    if (
      user.role === "Admin" &&
      !req.user.isPermanent
    ) {
      return res.status(403).json({ message: "Only the super admin can modify other admin roles." })
    }
    // If promoting to Manager, set manager field to null
    let roleChanged = false;
    if (role && role !== user.role) {
      roleChanged = true;
      if (role === "Manager") {
        user.manager = null;
      }
      user.role = role;
    }
    if (typeof isActive === "boolean") user.isActive = isActive
    let previousManagerId = user.manager ? user.manager.toString() : undefined;
    let newManagerId = manager !== undefined ? manager : undefined;
    let managerChanged = false;
    if (manager !== undefined) {
      if (!manager) {
        user.set('manager', undefined, { strict: false });
        managerChanged = previousManagerId !== undefined;
      } else {
        user.manager = manager;
        managerChanged = previousManagerId !== manager;
      }
    }
    await user.save()
    // Respond immediately
    res.json({ user: await User.findById(user._id).populate("manager", "firstName lastName email role") })
    // Fire-and-forget: Audit log
    AuditLog.create({
      user: req.user._id,
      action: `User Update`,
      details: `User ID: ${user._id}, New role: ${user.role}, Active: ${user.isActive}, Manager: ${user.manager}`
    }).catch(err => console.error("Audit log failed:", err));
    // Fire-and-forget: Emails
    const updatedUser = await User.findById(user._id).populate("manager", "firstName lastName email role")
    const now = dayjs().format('DD-MM-YYYY HH:mm:ss');
    // Manager change emails
    if (managerChanged) {
      if (updatedUser.manager) {
        sendEmail({
          to: updatedUser.email,
          subject: 'Your assigned manager has changed',
          body: `<p style='font-size:1.1em;'>Dear <strong>${updatedUser.firstName} ${updatedUser.lastName}</strong>,</p><p style='margin:16px 0;'>Your assigned manager has been updated by the admin.</p><ul style='margin:16px 0 24px 24px; font-size:1em;'><li><strong>New Manager:</strong> ${updatedUser.manager.firstName} ${updatedUser.manager.lastName} (${updatedUser.manager.email})</li><li><strong>Changed on:</strong> <span style='color:#6366f1;'>${now}</span></li></ul><p style='margin-top:16px;'>If you have any questions, please contact support.</p>`
        }).catch(err => console.error("Manager change email failed:", err));
        sendEmail({
          to: updatedUser.manager.email,
          subject: 'You have been assigned a new report',
          body: `<p style='font-size:1.1em;'>Dear <strong>${updatedUser.manager.firstName} ${updatedUser.manager.lastName}</strong>,</p><p style='margin:16px 0;'>You have been assigned as the manager for <strong>${updatedUser.firstName} ${updatedUser.lastName}</strong> (${updatedUser.email}).</p><ul style='margin:16px 0 24px 24px; font-size:1em;'><li><strong>Assigned on:</strong> <span style='color:#6366f1;'>${now}</span></li></ul><p style='margin-top:16px;'>Please log in to the system to view their requests and activities.</p>`
        }).catch(err => console.error("Manager assigned email failed:", err));
      } else if (previousManagerId) {
        const previousManager = await User.findById(previousManagerId);
        if (previousManager) {
          sendEmail({
            to: updatedUser.email,
            subject: 'Your manager has been unassigned',
            body: `<p style='font-size:1.1em;'>Dear <strong>${updatedUser.firstName} ${updatedUser.lastName}</strong>,</p><p style='margin:16px 0;'>You no longer have a manager assigned to you. Please contact the admin if you have questions.</p><ul style='margin:16px 0 24px 24px; font-size:1em;'><li><strong>Previous Manager:</strong> ${previousManager.firstName} ${previousManager.lastName} (${previousManager.email})</li><li><strong>Changed on:</strong> <span style='color:#6366f1;'>${now}</span></li></ul>`
          }).catch(err => console.error("Manager unassigned email failed:", err));
          sendEmail({
            to: previousManager.email,
            subject: 'A report has been unassigned from you',
            body: `<p style='font-size:1.1em;'>Dear <strong>${previousManager.firstName} ${previousManager.lastName}</strong>,</p><p style='margin:16px 0;'>You are no longer the manager for <strong>${updatedUser.firstName} ${updatedUser.lastName}</strong> (${updatedUser.email}).</p><ul style='margin:16px 0 24px 24px; font-size:1em;'><li><strong>Unassigned on:</strong> <span style='color:#6366f1;'>${now}</span></li></ul>`
          }).catch(err => console.error("Manager unassigned notify email failed:", err));
        }
      }
    }
    // Role change email
    if (roleChanged) {
      sendEmail({
        to: updatedUser.email,
        subject: 'Your role has been updated',
        body: `<p style='font-size:1.1em;'>Dear <strong>${updatedUser.firstName} ${updatedUser.lastName}</strong>,</p><p style='margin:16px 0;'>Your role has been updated to <strong>${updatedUser.role}</strong> by the admin.</p><p style='margin-top:16px;'>If you have any questions, please contact support.</p>`
      }).catch(err => console.error("Role change email failed:", err));
    }
    // Status change email
    if (typeof isActive === "boolean") {
      const subject = isActive
        ? "✅ Your Account Has Been Approved"
        : "⚠️ Your Account Has Been Deactivated";
      const html = isActive
        ? `<p>Your account has been successfully approved. You can now log in and access the system.</p>`
        : `<p>Your account has been deactivated. Contact the admin for more details.</p>`;
      sendEmail({
        to: updatedUser.email,
        subject,
        body: html
      }).catch(err => console.error("Status update email failed:", err));
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" })
  }
})

// Get audit log (Admin only)
router.get("/audit-log", auth, authorize("Admin"), async (req, res) => {
  try {
    let { userId, action, startDate, endDate } = req.query;
    // Clean up empty strings
    userId = userId && userId.trim() !== '' ? userId : undefined;
    action = action && action.trim() !== '' ? action : undefined;
    startDate = startDate && startDate.trim() !== '' ? startDate : undefined;
    endDate = endDate && endDate.trim() !== '' ? endDate : undefined;
    const filter = {};
    if (userId) filter.user = userId;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start)) filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end)) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
      // Remove createdAt if empty
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }
    // Debug logging
    console.log("Audit log filter query params:", req.query);
    console.log("Constructed filter object:", filter);
    const logs = await AuditLog.find(filter)
      .populate("user", "firstName lastName email role")
      .sort({ createdAt: -1 })
      .select("createdAt user action details");
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
})

// Multer storage config for profile pictures
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})
const upload = multer({ storage })

// Upload profile picture
router.post(
  "/:id/profile-picture",
  auth,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (req.user.role !== "Admin" && req.user._id.toString() !== req.params.id) {
        return res.status(403).json({ message: "Not authorized" })
      }
      const user = await User.findById(req.params.id)
      if (!user) return res.status(404).json({ message: "User not found" })
      if (!req.file) return res.status(400).json({ message: "No file uploaded" })
      user.profilePicture = `/uploads/${req.file.filename}`
      await user.save()
      res.json({ profilePicture: user.profilePicture })
    } catch (error) {
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Create a new user (Admin only)
router.post("/", auth, authorize("Admin"), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, department, manager, isActive } = req.body
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ message: "All fields are required" })
    }
    if (!["Employee", "Manager", "Admin"].includes(role)) {
      return res.status(400).json({ message: "Role must be Employee, Manager, or Admin" })
    }
    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(400).json({ message: "Email already exists" })
    }
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      department: department || "General",
      manager: manager || undefined,
      isActive: isActive !== undefined ? isActive : true,
    })
    // Respond immediately
    res.status(201).json({
      user,
      message: "User created successfully."
    });
    // Fire-and-forget: Welcome email
    const now = dayjs().format('DD-MM-YYYY HH:mm:ss');
    sendEmail({
      to: user.email,
      subject: `🎉 Welcome to Travel & Expense Management – ${role} Access Granted`,
      body: `
        <h2>Welcome Aboard!</h2>
        <p>Your account has been created with the following credentials:</p>
        <ul>
          <li><strong>Email:</strong> ${user.email}</li>
          <li><strong>Password:</strong> ${password}</li>
          <li><strong>Role:</strong> ${role}</li>
        </ul>
        <p>Please login and change your password after first use for security.</p>
        <ul style='margin:16px 0 24px 24px; font-size:1em;'>
          <li><strong>Created on:</strong> <span style='color:#6366f1;'>${now}</span></li>
        </ul>
      `
    }).catch(err => console.error("Welcome email failed:", err));
  } catch (error) {
    console.error("User creation failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
})

// Delete user (Admin only, cannot delete permanent admin)
router.delete('/:id', auth, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    // Block self-deletion
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(403).json({ message: 'You cannot delete your own account.' })
    }
    if (user.isPermanent) {
      return res.status(403).json({ message: 'Cannot delete permanent admin account' })
    }
    await user.deleteOne()
    await AuditLog.create({
      user: req.user._id,
      action: 'User Delete',
      details: `User ID: ${user._id}, Email: ${user.email}`
    })
    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Approve user
router.patch('/:id/approve', auth, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.isActive) return res.status(400).json({ message: 'User is already active' })
    user.isActive = true
    await user.save()
    const now = dayjs().format('DD-MM-YYYY HH:mm:ss')
    await sendEmail({
      to: user.email,
      subject: 'Your account has been approved',
      body: `
        <p style='font-size:1.1em;'>Dear <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p style='margin:16px 0;'>Congratulations! Your account has been <span style='color:#22c55e; font-weight:bold;'>approved</span> by the admin. You can now log in and access the system.</p>
        <ul style='margin:16px 0 24px 24px; font-size:1em;'>
          <li><strong>Email:</strong> ${user.email}</li>
          <li><strong>Approved on:</strong> <span style='color:#6366f1;'>${now}</span></li>
        </ul>
        <p style='margin-top:16px;'>If you have any questions, please contact support.</p>
        <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${now}</div>
      `
    })
    res.json({ message: 'User approved and notified.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reject user
router.patch('/:id/reject', auth, authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    const now = dayjs().format('DD-MM-YYYY HH:mm:ss')
    await sendEmail({
      to: user.email,
      subject: 'Your account registration was rejected',
      body: `
        <p style='font-size:1.1em;'>Dear <strong>${user.firstName} ${user.lastName}</strong>,</p>
        <p style='margin:16px 0;'>We regret to inform you that your registration was <span style='color:#ef4444; font-weight:bold;'>not approved</span> by the admin.</p>
        <ul style='margin:16px 0 24px 24px; font-size:1em;'>
          <li><strong>Email:</strong> ${user.email}</li>
          <li><strong>Rejected on:</strong> <span style='color:#6366f1;'>${now}</span></li>
        </ul>
        <p style='margin-top:16px;'>If you believe this is a mistake, please contact support for assistance.</p>
        <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${now}</div>
      `
    })
    await user.deleteOne()
    res.json({ message: 'User rejected and notified.' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router 