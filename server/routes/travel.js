const express = require("express")
const { body, validationResult } = require("express-validator")
const TravelRequest = require("../models/TravelRequest")
const Notification = require("../models/Notification")
const { auth, authorize } = require("../middleware/auth")
const { Parser } = require('json2csv')
const AuditLog = require("../models/AuditLog")
const sendEmail = require("../utils/sendEmail")
const User = require("../models/User")
const dayjs = require('dayjs')
const multer = require("multer")
const path = require("path")

const router = express.Router()

// Multer storage config for travel documents
const travelStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})
const travelUpload = multer({ storage: travelStorage })

// Create travel request
router.post(
  "/",
  auth,
  (req, res, next) => {
    if (req.user.role !== "Employee" && req.user.role !== "Manager") {
      return res.status(403).json({ message: "Only employees or managers can submit travel requests" })
    }
    next()
  },
  [
    body("destination").notEmpty().withMessage("Destination is required"),
    body("purpose").notEmpty().withMessage("Purpose is required"),
    body("startDate").isISO8601().withMessage("Valid start date is required"),
    body("endDate").isISO8601().withMessage("Valid end date is required"),
    body("estimatedCost").isNumeric().withMessage("Valid estimated cost is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      // Date validation
      const today = dayjs().startOf('day')
      const startDate = dayjs(req.body.startDate).startOf('day')
      const endDate = dayjs(req.body.endDate).startOf('day')
      if (startDate.isBefore(today)) {
        return res.status(400).json({ message: 'Travel start date must be today or a future date.' })
      }
      if (endDate.isBefore(startDate)) {
        return res.status(400).json({ message: 'Return date must be the same as or after travel start date.' })
      }

      const travelRequest = new TravelRequest({
        ...req.body,
        employee: req.user._id,
      })

      await travelRequest.save()
      await travelRequest.populate({ path: "employee", select: "firstName lastName email department manager role", populate: { path: "manager", select: "firstName lastName email" } })

      res.status(201).json(travelRequest)

      // Fire-and-forget side effects
      ;(async () => {
        try {
          // Socket.IO
          const io = req.app.get('io')
          const connectedUsers = req.app.get('connectedUsers')
          // Notify assigned manager (if any)
          if (travelRequest.employee.manager) {
            const managerUser = await User.findById(travelRequest.employee.manager)
            if (managerUser && managerUser.isActive) {
              Notification.create({
                recipient: managerUser._id,
                title: `New Travel Request Submitted`,
                message: `${travelRequest.employee.firstName} ${travelRequest.employee.lastName} submitted a travel request to ${travelRequest.destination}.`,
                type: "travel_submitted",
                relatedId: travelRequest._id,
                relatedModel: "TravelRequest",
              }).then(notif => {
                const socketId = connectedUsers[managerUser._id.toString()]
                if (socketId) io.to(socketId).emit('notification', notif)
              }).catch(err => console.error('Manager notification failed:', err))
            }
          }
          // Notify all admins
          const admins = await User.find({ role: "Admin", isActive: true })
          if (admins.length > 0) {
            Notification.insertMany(admins.map(admin => ({
              recipient: admin._id,
              title: `Travel Request Submitted`,
              message: `${travelRequest.employee.firstName} ${travelRequest.employee.lastName} submitted a travel request to ${travelRequest.destination}.`,
              type: "travel_submitted",
              relatedId: travelRequest._id,
              relatedModel: "TravelRequest",
            }))).then(adminNotifs => {
              for (let i = 0; i < admins.length; i++) {
                const socketId = connectedUsers[admins[i]._id.toString()]
                if (socketId) io.to(socketId).emit('notification', adminNotifs[i])
              }
            }).catch(err => console.error('Admin notifications failed:', err))
          }

          // Send confirmation email to user (with formatted dates)
          const now = dayjs().format('DD-MM-YYYY HH:mm:ss')
          sendEmail({
            to: travelRequest.employee.email,
            subject: "Travel Request Submitted",
            body: `
              <p style='font-size:1.1em;'>Dear <strong>${travelRequest.employee.firstName} ${travelRequest.employee.lastName}</strong>,</p>
              <p style='margin:16px 0;'>Your travel request to <strong>${travelRequest.destination}</strong> from <strong>${dayjs(travelRequest.startDate).format('DD-MM-YYYY HH:mm:ss')}</strong> to <strong>${dayjs(travelRequest.endDate).format('DD-MM-YYYY HH:mm:ss')}</strong> has been <span style='color:#22c55e; font-weight:bold;'>successfully submitted</span> and is pending approval.</p>
              <span style='display:inline-block; background: #e0e7ff; color: #3730a3; padding: 6px 16px; border-radius: 8px; font-size: 1.05em; margin-top: 8px;'>
                Submitted on: <strong>${now}</strong>
              </span>
              <p style='margin-top:16px;'>You will receive an update as soon as your manager or admin reviews your request.<br/>Thank you for using our system!</p>
              <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${now}</div>
            `
          }).catch(err => console.error('Email to employee failed:', err))
          // Send email to assigned manager (if any)
          if (travelRequest.employee.manager) {
            const managerUser = await User.findById(travelRequest.employee.manager)
            if (managerUser && managerUser.isActive) {
              sendEmail({
                to: managerUser.email,
                subject: "New Travel Request Submitted",
                body: `
                  <p style='font-size:1.1em;'>Dear <strong>${managerUser.firstName} ${managerUser.lastName}</strong>,</p>
                  <p style='margin:16px 0;'>A new travel request has been submitted by <strong>${travelRequest.employee.firstName} ${travelRequest.employee.lastName}</strong> to <strong>${travelRequest.destination}</strong>.</p>
                  <ul style='margin:16px 0 24px 24px; font-size:1em;'>
                    <li><strong>Travel Dates:</strong> ${dayjs(travelRequest.startDate).format('DD-MM-YYYY HH:mm:ss')} to ${dayjs(travelRequest.endDate).format('DD-MM-YYYY HH:mm:ss')}</li>
                    <li><strong>Submitted on:</strong> <span style='color:#6366f1;'>${now}</span></li>
                  </ul>
                  <p style='margin-top:16px;'>Please review and take action in the system.</p>
                  <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${now}</div>
                `
              }).catch(err => console.error('Email to manager failed:', err))
            }
          }
        } catch (err) {
          console.error('Side effect error:', err)
        }
      })()
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Get travel requests
router.get("/", auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query
    const query = {}

    // If employee, only show their requests
    if (req.user.role === "Employee") {
      query.employee = req.user._id
    }
    // If manager, show their own requests if employee param matches, else show requests from employees they manage
    else if (req.user.role === "Manager") {
      if (req.query.employee && req.query.employee === req.user._id.toString()) {
        // Manager wants to see their own requests
        query.employee = req.user._id;
      } else {
        // Manager wants to see requests from employees they manage
        const employees = await User.find({ manager: req.user._id }, '_id');
        if (employees.length === 0) {
          query.employee = { $in: [] };
        } else {
          query.employee = { $in: employees.map(e => e._id) };
        }
      }
    }
    if (status) {
      query.status = status
    }
    const travelRequests = await TravelRequest.find(query)
      .populate({ path: "employee", select: "firstName lastName email department manager role", populate: { path: "manager", select: "firstName lastName email" } })
      .populate("reviewedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
    const total = await TravelRequest.countDocuments(query)
    res.json({
      travelRequests,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Update travel request status
router.patch("/:id/status", auth, authorize("Manager", "Admin"), async (req, res) => {
  try {
    const { status, reviewComments } = req.body
    const travelRequest = await TravelRequest.findById(req.params.id).populate(
      "employee",
      "firstName lastName email manager role",
    )
    if (!travelRequest) {
      return res.status(404).json({ message: "Travel request not found" })
    }
    // Prevent self-approval
    if (travelRequest.employee._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot approve or reject your own travel request" })
    }
    // Hierarchical override logic
    const isFinal = (travelRequest.adminStatus === "Approved" || travelRequest.adminStatus === "Rejected")
    if (isFinal) {
      return res.status(400).json({ message: "This request is finalized by admin. No further action allowed." })
    }
    if (req.user.role === "Manager") {
      if (!travelRequest.employee.manager || travelRequest.employee.manager.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "You are not authorized to approve/reject this request" })
      }
      if (travelRequest.adminStatus === "Approved" || travelRequest.adminStatus === "Rejected") {
        return res.status(400).json({ message: "Admin has already made a final decision. Manager cannot act." })
      }
      travelRequest.managerStatus = status
      travelRequest.managerReviewedBy = req.user._id
      travelRequest.managerReviewComments = reviewComments
      travelRequest.managerReviewDate = new Date()
      // Manager's action sets main status unless admin has acted
      if (!travelRequest.adminStatus || travelRequest.adminStatus === "Pending") {
        travelRequest.status = status
      }
    } else if (req.user.role === "Admin") {
      travelRequest.adminStatus = status
      travelRequest.adminReviewedBy = req.user._id
      travelRequest.adminReviewComments = reviewComments
      travelRequest.adminReviewDate = new Date()
      // Admin's action always sets main status
      travelRequest.status = status
    } else {
      return res.status(403).json({ message: "Only manager or admin can approve/reject requests." })
    }

    await travelRequest.save()

    // Socket.IO
    const io = req.app.get('io')
    const connectedUsers = req.app.get('connectedUsers')

    // Notify the submitter (employee or manager) only once
    if (travelRequest.employee.role === "Manager") {
      // If submitter is a manager, send only the manager notification
      if (req.user.role === "Admin") {
        const managerNotification = new Notification({
          recipient: travelRequest.employee._id,
          title: `Travel Request ${status} (Admin Action)`,
          message: `Your travel request to ${travelRequest.destination} has been ${status.toLowerCase()} by Admin ${req.user.firstName} ${req.user.lastName}.` + (reviewComments ? `\nAdmin's comment: ${reviewComments}` : ''),
          type: status === "Approved" ? "travel_approved" : "travel_rejected",
          relatedId: travelRequest._id,
          relatedModel: "TravelRequest",
        })
        await managerNotification.save()
        const socketId = connectedUsers[travelRequest.employee._id.toString()]
        if (socketId) io.to(socketId).emit('notification', managerNotification)
      } else {
        // If a manager is acting on another manager's request, send the generic notification
        const employeeNotification = new Notification({
          recipient: travelRequest.employee._id,
          title: `Travel Request ${status}`,
          message: `Your travel request to ${travelRequest.destination} has been ${status.toLowerCase()} by ${req.user.firstName} ${req.user.lastName}.` + (reviewComments ? `\nManager/Admin's comment: ${reviewComments}` : ''),
          type: status === "Approved" ? "travel_approved" : "travel_rejected",
          relatedId: travelRequest._id,
          relatedModel: "TravelRequest",
        })
        await employeeNotification.save()
        const empSocketId = connectedUsers[travelRequest.employee._id.toString()]
        if (empSocketId) io.to(empSocketId).emit('notification', employeeNotification)
      }
    } else {
      // If submitter is an employee, always send the generic notification
      const employeeNotification = new Notification({
        recipient: travelRequest.employee._id,
        title: `Travel Request ${status}`,
        message: `Your travel request to ${travelRequest.destination} has been ${status.toLowerCase()} by ${req.user.firstName} ${req.user.lastName}.` + (reviewComments ? `\nManager/Admin's comment: ${reviewComments}` : ''),
        type: status === "Approved" ? "travel_approved" : "travel_rejected",
        relatedId: travelRequest._id,
        relatedModel: "TravelRequest",
      })
      await employeeNotification.save()
      const empSocketId = connectedUsers[travelRequest.employee._id.toString()]
      if (empSocketId) io.to(empSocketId).emit('notification', employeeNotification)
    }

    // Log approval/rejection action to AuditLog
    await AuditLog.create({
      user: req.user._id,
      action: `TravelRequest ${status}`,
      details: `Request ID: ${travelRequest._id}, Destination: ${travelRequest.destination}, Manager's comment: ${reviewComments || ''}`
    })

    // Send email to employee (user) on approval/rejection
    if (travelRequest.employee && travelRequest.employee.email) {
      sendEmail({
        to: travelRequest.employee.email,
        subject: `Travel Request ${status}`,
        body: `
          <p style='font-size:1.1em;'>Dear <strong>${travelRequest.employee.firstName} ${travelRequest.employee.lastName}</strong>,</p>
          <p style='margin:16px 0;'>Your travel request to <strong>${travelRequest.destination}</strong> from <strong>${dayjs(travelRequest.startDate).format('DD-MM-YYYY HH:mm:ss')}</strong> to <strong>${dayjs(travelRequest.endDate).format('DD-MM-YYYY HH:mm:ss')}</strong> has been ${status.toLowerCase()} by ${req.user.firstName} ${req.user.lastName}.` + (reviewComments ? `\nManager/Admin's comment: ${reviewComments}` : '') + `</p>
          <span style='display:inline-block; background: #e0e7ff; color: #3730a3; padding: 6px 16px; border-radius: 8px; font-size: 1.05em; margin-top: 8px;'>
            Reviewed on: <strong>${dayjs(travelRequest.reviewDate).format('DD-MM-YYYY HH:mm:ss')}</strong>
          </span>
          <p style='margin-top:16px;'>Thank you for using our system!</p>
          <div style='margin-top:24px; color:#64748b; font-size:0.98em;'>Sent on: ${dayjs().format('DD-MM-YYYY HH:mm:ss')}</div>
        `
      }).catch(err => console.error('Email failed:', err))
    }

    res.status(200).json(travelRequest)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

// Upload document for a travel request
router.post(
  "/:id/document",
  auth,
  travelUpload.single("document"),
  async (req, res) => {
    try {
      const request = await TravelRequest.findById(req.params.id)
      if (!request) {
        return res.status(404).json({ message: "Travel request not found" })
      }
      // Only the owner or admin/manager can upload
      if (
        request.employee.toString() !== req.user._id.toString() &&
        !["Admin", "Manager"].includes(req.user.role)
      ) {
        return res.status(403).json({ message: "Not authorized" })
      }
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" })
      }
      request.documentUrl = `/uploads/${req.file.filename}`
      await request.save()
      res.json(request)
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Server error" })
    }
  },
)

// Export travel requests as CSV
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
    // Search filter (employee name, destination, purpose)
    let travelRequests = await TravelRequest.find(query)
      .populate('employee', 'firstName lastName department')
      .populate('reviewedBy', 'firstName lastName');
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      travelRequests = travelRequests.filter(r =>
        (r.destination && r.destination.toLowerCase().includes(search)) ||
        (r.purpose && r.purpose.toLowerCase().includes(search)) ||
        (r.employee && (
          (r.employee.firstName && r.employee.firstName.toLowerCase().includes(search)) ||
          (r.employee.lastName && r.employee.lastName.toLowerCase().includes(search))
        ))
      );
    }
    const fields = [
      { label: 'Destination', value: 'destination' },
      { label: 'Purpose', value: 'purpose' },
      { label: 'Start Date', value: row => row.startDate ? (() => { const d = new Date(row.startDate); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}` })() : '' },
      { label: 'End Date', value: row => row.endDate ? (() => { const d = new Date(row.endDate); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}` })() : '' },
      { label: 'Estimated Cost', value: 'estimatedCost' },
      { label: 'Priority', value: 'priority' },
      { label: 'Status', value: 'status' },
      { label: 'Submission Date', value: row => row.createdAt ? (() => { const d = new Date(row.createdAt); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}` })() : '' },
      { label: 'Employee', value: row => row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '' },
      { label: 'Department', value: row => row.employee ? row.employee.department : '' },
      { label: 'Reviewed By', value: row => row.reviewedBy ? `${row.reviewedBy.firstName} ${row.reviewedBy.lastName}` : '' },
    ];
    if (travelRequests.length === 0) {
      return res.status(400).json({ message: 'No data to export' });
    }
    const parser = new Parser({ fields });
    const csv = parser.parse(travelRequests);
    res.header('Content-Type', 'text/csv');
    res.attachment('travel_requests.csv');
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router