const express = require("express")
const { body, validationResult } = require("express-validator")
const ExpenseClaim = require("../models/ExpenseClaim")
const TravelRequest = require("../models/TravelRequest")
const Notification = require("../models/Notification")
const { auth, authorize } = require("../middleware/auth")
const multer = require("multer")
const path = require("path")
const { Parser } = require('json2csv')
const AuditLog = require("../models/AuditLog")
const sendEmail = require("../utils/sendEmail")
const User = require("../models/User")
const dayjs = require('dayjs')

const router = express.Router()

// Multer storage config
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

// Create expense claim
router.post(
  "/",
  auth,
  (req, res, next) => {
    if (req.user.role !== "Employee" && req.user.role !== "Manager") {
      return res.status(403).json({ message: "Only employees or managers can submit expense claims" })
    }
    next()
  },
  [
    body("travelRequest").notEmpty().withMessage("Travel request is required"),
    body("amount").isNumeric().withMessage("Valid amount is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("expenseDate").isISO8601().withMessage("Valid expense date is required"),
    body("category").notEmpty().withMessage("Category is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      // Verify travel request exists and is approved
      const travelRequest = await TravelRequest.findById(req.body.travelRequest)
      if (!travelRequest || travelRequest.status !== "Approved") {
        return res.status(400).json({ message: "Invalid or unapproved travel request" })
      }

      // Validate expenseDate is within travel window
      const expenseDate = dayjs(req.body.expenseDate).startOf('day')
      const travelStart = dayjs(travelRequest.startDate).startOf('day')
      const travelEnd = dayjs(travelRequest.endDate).startOf('day')
      if (expenseDate.isBefore(travelStart) || expenseDate.isAfter(travelEnd)) {
        return res.status(400).json({ message: `Expense date must be within the travel period: ${travelStart.format('DD-MM-YYYY')} to ${travelEnd.format('DD-MM-YYYY')}` })
      }

      const expenseClaim = new ExpenseClaim({
        ...req.body,
        employee: req.user._id,
      })

      await expenseClaim.save()
      await expenseClaim.populate([
        { path: "employee", select: "firstName lastName username email department manager role", populate: { path: "manager", select: "firstName lastName email" } },
        { path: "travelRequest", select: "destination purpose" },
      ])

      // Socket.IO
      const io = req.app.get('io')
      const connectedUsers = req.app.get('connectedUsers')

      // Notify assigned manager (if any)
      if (expenseClaim.employee.manager) {
        const managerUser = await User.findById(expenseClaim.employee.manager)
        if (managerUser && managerUser.isActive) {
          const notif = await Notification.create({
            recipient: managerUser._id,
            title: `New Expense Claim Submitted`,
            message: `${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName} submitted an expense claim of $${expenseClaim.amount} for ${expenseClaim.travelRequest.destination}.`,
            type: "expense_submitted",
            relatedId: expenseClaim._id,
            relatedModel: "ExpenseClaim",
          })
          // Emit real-time notification
          const socketId = connectedUsers[managerUser._id.toString()]
          if (socketId) io.to(socketId).emit('notification', notif)
        }
      }
      // Notify all admins
      const admins = await User.find({ role: "Admin", isActive: true })
      if (admins.length > 0) {
        const adminNotifs = await Notification.insertMany(admins.map(admin => ({
          recipient: admin._id,
          title: `Expense Claim Submitted`,
          message: `${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName} submitted an expense claim of $${expenseClaim.amount} for ${expenseClaim.travelRequest.destination}.`,
          type: "expense_submitted",
          relatedId: expenseClaim._id,
          relatedModel: "ExpenseClaim",
        })))
        for (let i = 0; i < admins.length; i++) {
          const socketId = connectedUsers[admins[i]._id.toString()]
          if (socketId) io.to(socketId).emit('notification', adminNotifs[i])
        }
      }

      // Send confirmation email to user (with formatted date)
      const now = dayjs().format('DD-MM-YYYY HH:mm:ss')
      sendEmail({
        to: expenseClaim.employee.email,
        subject: "Expense Claim Submitted",
        body: `
          <p style='font-size:1.1em;'>Dear <strong>${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName}</strong>,</p>
          <p style='margin:16px 0;'>Your expense claim of <strong>$${expenseClaim.amount}</strong> for <strong>${expenseClaim.travelRequest.destination}</strong> on <strong>${dayjs(expenseClaim.expenseDate).format('DD-MM-YYYY HH:mm:ss')}</strong> has been <span style='color:#22c55e; font-weight:bold;'>successfully submitted</span> and is pending approval.</p>
          <span style='display:inline-block; background: #e0e7ff; color: #3730a3; padding: 6px 16px; border-radius: 8px; font-size: 1.05em; margin-top: 8px;'>
            Submitted on: <strong>${now}</strong>
          </span>
          <p style='margin-top:16px;'>You will receive an update as soon as your manager or admin reviews your claim.<br/>Thank you for using our system!</p>
          <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${now}</div>
        `
      }).catch(err => console.error('Email failed:', err))
      // Send email to assigned manager (if any)
      if (expenseClaim.employee.manager) {
        const managerUser = await User.findById(expenseClaim.employee.manager)
        if (managerUser && managerUser.isActive) {
          sendEmail({
            to: managerUser.email,
            subject: "New Expense Claim Submitted",
            body: `
              <p style='font-size:1.1em;'>Dear <strong>${managerUser.firstName} ${managerUser.lastName}</strong>,</p>
              <p style='margin:16px 0;'>A new expense claim has been submitted by <strong>${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName}</strong> for <strong>${expenseClaim.travelRequest.destination}</strong>.</p>
              <ul style='margin:16px 0 24px 24px; font-size:1em;'>
                <li><strong>Amount:</strong> $${expenseClaim.amount}</li>
                <li><strong>Expense Date:</strong> ${dayjs(expenseClaim.expenseDate).format('DD-MM-YYYY HH:mm:ss')}</li>
                <li><strong>Submitted on:</strong> <span style='color:#6366f1;'>${now}</span></li>
              </ul>
              <p style='margin-top:16px;'>Please review and take action in the system.</p>
              <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${now}</div>
            `
          }).catch(err => console.error('Email failed:', err))
        }
      }

      res.status(201).json(expenseClaim)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Get expense claims
router.get("/", auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query
    const query = {}

    // If employee, only show their claims
    if (req.user.role === "Employee") {
      query.employee = req.user._id
    }
    // If manager, show their own claims if employee param matches, else show claims from employees they manage
    else if (req.user.role === "Manager") {
      if (req.query.employee && req.query.employee === req.user._id.toString()) {
        // Manager wants to see their own claims
        query.employee = req.user._id;
      } else {
        // Manager wants to see claims from employees they manage
        const employees = await User.find({ manager: req.user._id }, '_id');
        if (employees.length === 0) {
          query.employee = { $in: [] };
        } else {
          query.employee = { $in: employees.map(e => e._id) };
        }
      }
    }
    // Admins see all claims (no filter)

    if (status) {
      query.status = status
    }

    const expenseClaims = await ExpenseClaim.find(query)
      .populate({ path: "employee", select: "firstName lastName username email department manager role", populate: { path: "manager", select: "firstName lastName email" } })
      .populate("travelRequest", "destination purpose")
      .populate("reviewedBy", "firstName lastName username")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await ExpenseClaim.countDocuments(query)

    res.json({
      expenseClaims,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Update expense claim status
router.patch("/:id/status", auth, authorize("Manager", "Admin"), async (req, res) => {
  try {
    const { status, reviewComments } = req.body

    const expenseClaim = await ExpenseClaim.findById(req.params.id)
      .populate("employee", "firstName lastName username email manager role")
      .populate("travelRequest", "destination")

    if (!expenseClaim) {
      return res.status(404).json({ message: "Expense claim not found" })
    }
    // Prevent self-approval
    if (expenseClaim.employee._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot approve or reject your own expense claim" })
    }

    // Hierarchical override logic
    const isFinal = (expenseClaim.adminStatus === "Approved" || expenseClaim.adminStatus === "Rejected")
    if (isFinal) {
      return res.status(400).json({ message: "This claim is finalized by admin. No further action allowed." })
    }
    if (req.user.role === "Manager") {
      if (!expenseClaim.employee.manager || expenseClaim.employee.manager.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "You are not authorized to approve/reject this claim" })
      }
      if (expenseClaim.adminStatus === "Approved" || expenseClaim.adminStatus === "Rejected") {
        return res.status(400).json({ message: "Admin has already made a final decision. Manager cannot act." })
      }
      expenseClaim.managerStatus = status
      expenseClaim.managerReviewedBy = req.user._id
      expenseClaim.managerReviewComments = reviewComments
      expenseClaim.managerReviewDate = new Date()
      // Manager's action sets main status unless admin has acted
      if (!expenseClaim.adminStatus || expenseClaim.adminStatus === "Pending") {
        expenseClaim.status = status
      }
    } else if (req.user.role === "Admin") {
      expenseClaim.adminStatus = status
      expenseClaim.adminReviewedBy = req.user._id
      expenseClaim.adminReviewComments = reviewComments
      expenseClaim.adminReviewDate = new Date()
      // Admin's action always sets main status
      expenseClaim.status = status
    } else {
      return res.status(403).json({ message: "Only manager or admin can approve/reject claims." })
    }

    await expenseClaim.save()

    // Respond to client immediately
    res.json(expenseClaim)

    // Fire-and-forget side effects
    ;(async () => {
      try {
        // Notification for employee
        const employeeNotification = new Notification({
          recipient: expenseClaim.employee._id,
          title: `Expense Claim ${status}`,
          message: `Your expense claim of $${expenseClaim.amount} for ${expenseClaim.travelRequest.destination} has been ${status.toLowerCase()} by ${req.user.firstName} ${req.user.lastName}.` + (reviewComments ? `\nManager/Admin's comment: ${reviewComments}` : ''),
          type: status === "Approved" ? "expense_approved" : "expense_rejected",
          relatedId: expenseClaim._id,
          relatedModel: "ExpenseClaim",
        })
        employeeNotification.save().catch(err => console.error('Notification failed:', err))

        // Real-time notification to manager if submitter is a manager and admin acts
        if (req.user.role === "Admin" && expenseClaim.employee.role === "Manager") {
          const io = req.app.get('io')
          const connectedUsers = req.app.get('connectedUsers')
          const managerNotification = new Notification({
            recipient: expenseClaim.employee._id,
            title: `Expense Claim ${status} (Admin Action)`,
            message: `Your expense claim of $${expenseClaim.amount} for ${expenseClaim.travelRequest.destination} has been ${status.toLowerCase()} by Admin ${req.user.firstName} ${req.user.lastName}.` + (reviewComments ? `\nAdmin's comment: ${reviewComments}` : ''),
            type: status === "Approved" ? "expense_approved" : "expense_rejected",
            relatedId: expenseClaim._id,
            relatedModel: "ExpenseClaim",
          })
          await managerNotification.save()
          const socketId = connectedUsers[expenseClaim.employee._id.toString()]
          if (socketId) io.to(socketId).emit('notification', managerNotification)
        }

        // Notification for all admins
        const admins = await User.find({ role: "Admin", isActive: true })
        const adminNotifications = admins
          .filter(admin => admin._id.toString() !== req.user._id.toString())
          .map(admin => ({
            recipient: admin._id,
            title: `Expense Claim ${status} by ${req.user.firstName} ${req.user.lastName}`,
            message: `Expense claim of $${expenseClaim.amount} for ${expenseClaim.travelRequest.destination} submitted by ${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName} has been ${status.toLowerCase()} by ${req.user.firstName} ${req.user.lastName}.` + (reviewComments ? `\nComment: ${reviewComments}` : ''),
            type: status === "Approved" ? "expense_approved" : "expense_rejected",
            relatedId: expenseClaim._id,
            relatedModel: "ExpenseClaim",
          }))
        if (adminNotifications.length > 0) {
          Notification.insertMany(adminNotifications).catch(err => console.error('Notification insertMany failed:', err))
        }

        // Log approval/rejection action
        AuditLog.create({
          user: req.user._id,
          action: `ExpenseClaim ${status}`,
          details: `Claim ID: ${expenseClaim._id}, Amount: $${expenseClaim.amount}, Manager's comment: ${reviewComments || ''}`
        }).catch(err => console.error('Audit log failed:', err))

        // Send email to employee (user) on approval/rejection
        if (expenseClaim.employee && expenseClaim.employee.email) {
          sendEmail({
            to: expenseClaim.employee.email,
            subject: `Your Expense Claim has been ${status}`,
            body: `
              <p style='font-size:1.1em;'>Dear <strong>${expenseClaim.employee.firstName} ${expenseClaim.employee.lastName}</strong>,</p>
              <p style='margin:16px 0;'>Your expense claim of <strong>$${expenseClaim.amount}</strong> for <strong>${expenseClaim.travelRequest.destination}</strong> has been <span style='color:${status === 'Approved' ? '#22c55e' : '#ef4444'}; font-weight:bold;'>${status.toLowerCase()}</span> by ${req.user.firstName} ${req.user.lastName} (${req.user.role}).</p>
              ${reviewComments ? `<p style='margin:12px 0;'><strong>Remarks:</strong> ${reviewComments}</p>` : ''}
              <ul style='margin:16px 0 24px 24px; font-size:1em;'>
                <li><strong>Reviewed on:</strong> <span style='color:#6366f1;'>${dayjs(expenseClaim.reviewDate).format('DD-MM-YYYY HH:mm:ss')}</span></li>
              </ul>
              <p style='margin-top:16px;'>If you have any questions, please contact support.</p>
            `
          }).catch(err => console.error('Email failed:', err))
        }
      } catch (err) {
        console.error('Side effect error:', err)
      }
    })()
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Upload receipt for an expense claim
router.post(
  "/:id/receipt",
  auth,
  upload.single("receipt"),
  async (req, res) => {
    try {
      const claim = await ExpenseClaim.findById(req.params.id)
      if (!claim) {
        return res.status(404).json({ message: "Expense claim not found" })
      }
      // Only the owner or admin/manager can upload
      if (
        claim.employee.toString() !== req.user._id.toString() &&
        !["Admin", "Manager"].includes(req.user.role)
      ) {
        return res.status(403).json({ message: "Not authorized" })
      }
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" })
      }
      claim.receiptUrl = `/uploads/${req.file.filename}`
      await claim.save()
      res.json(claim)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Export expense claims as CSV
router.get('/export', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Manager') {
      const employees = await User.find({ manager: req.user._id }, '_id');
      if (employees.length === 0) {
        query.employee = { $in: [] };
      } else {
        query.employee = { $in: employees.map(e => e._id) };
      }
    }
    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }
    // Date range filter
    if (req.query.start || req.query.end) {
      query.createdAt = {};
      if (req.query.start) query.createdAt.$gte = new Date(req.query.start);
      if (req.query.end) {
        // Add 1 day to end date to make it inclusive
        const endDate = new Date(req.query.end);
        endDate.setDate(endDate.getDate() + 1);
        query.createdAt.$lt = endDate;
      }
    }
    // Search filter (employee name, description, travel destination, purpose)
    let expenseClaims = await ExpenseClaim.find(query)
      .populate('employee', 'firstName lastName username department')
      .populate('travelRequest', 'destination purpose');
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      expenseClaims = expenseClaims.filter(c =>
        (c.description && c.description.toLowerCase().includes(search)) ||
        (c.employee && (
          (c.employee.firstName && c.employee.firstName.toLowerCase().includes(search)) ||
          (c.employee.lastName && c.employee.lastName.toLowerCase().includes(search))
        )) ||
        (c.travelRequest && (
          (c.travelRequest.destination && c.travelRequest.destination.toLowerCase().includes(search)) ||
          (c.travelRequest.purpose && c.travelRequest.purpose.toLowerCase().includes(search))
        ))
      );
    }
    const fields = [
      { label: 'Description', value: 'description' },
      { label: 'Amount', value: 'amount' },
      { label: 'Expense Date', value: row => row.expenseDate ? (() => { const d = new Date(row.expenseDate); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}` })() : '' },
      { label: 'Category', value: 'category' },
      { label: 'Status', value: 'status' },
      { label: 'Submission Date', value: row => row.createdAt ? (() => { const d = new Date(row.createdAt); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}` })() : '' },
      { label: 'Employee', value: row => row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '' },
      { label: 'Department', value: row => row.employee ? row.employee.department : '' },
      { label: 'Travel Destination', value: row => row.travelRequest ? row.travelRequest.destination : '' },
      { label: 'Travel Purpose', value: row => row.travelRequest ? row.travelRequest.purpose : '' },
    ];
    if (expenseClaims.length === 0) {
      return res.status(400).json({ message: 'No data to export' });
    }
    const parser = new Parser({ fields });
    const csv = parser.parse(expenseClaims);
    res.header('Content-Type', 'text/csv');
    res.attachment('expense_claims.csv');
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
})

module.exports = router
