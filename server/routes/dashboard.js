const express = require("express")
const TravelRequest = require("../models/TravelRequest")
const ExpenseClaim = require("../models/ExpenseClaim")
const { auth } = require("../middleware/auth")

const router = express.Router()

// Get dashboard statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user._id
    const isEmployee = req.user.role === "Employee"

    // Base queries
    const travelQuery = isEmployee ? { employee: userId } : {}
    const expenseQuery = isEmployee ? { employee: userId } : {}

    // Travel request stats
    const travelStats = await TravelRequest.aggregate([
      { $match: travelQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalCost: { $sum: "$estimatedCost" },
        },
      },
    ])

    // Expense claim stats
    const expenseStats = await ExpenseClaim.aggregate([
      { $match: expenseQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ])

    // Monthly expense trends
    const monthlyExpenses = await ExpenseClaim.aggregate([
      { $match: { ...expenseQuery, status: "Approved" } },
      {
        $group: {
          _id: {
            year: { $year: "$expenseDate" },
            month: { $month: "$expenseDate" },
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ])

    // Recent activities
    const recentTravelRequests = await TravelRequest.find(travelQuery)
      .populate("employee", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5)

    const recentExpenseClaims = await ExpenseClaim.find(expenseQuery)
      .populate("employee", "firstName lastName")
      .populate("travelRequest", "destination")
      .sort({ createdAt: -1 })
      .limit(5)

    res.json({
      travelStats,
      expenseStats,
      monthlyExpenses,
      recentTravelRequests,
      recentExpenseClaims,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
