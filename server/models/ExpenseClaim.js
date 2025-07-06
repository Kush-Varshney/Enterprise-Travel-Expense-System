const mongoose = require("mongoose")

const expenseClaimSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    travelRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelRequest",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    expenseDate: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      enum: ["Transportation", "Accommodation", "Meals", "Miscellaneous"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewComments: {
      type: String,
      trim: true,
    },
    reviewDate: {
      type: Date,
    },
    receiptUrl: {
      type: String,
    },
    // Manager approval fields
    managerStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    managerReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    managerReviewComments: {
      type: String,
      trim: true,
    },
    managerReviewDate: {
      type: Date,
    },
    // Admin approval fields
    adminStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    adminReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adminReviewComments: {
      type: String,
      trim: true,
    },
    adminReviewDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("ExpenseClaim", expenseClaimSchema)
