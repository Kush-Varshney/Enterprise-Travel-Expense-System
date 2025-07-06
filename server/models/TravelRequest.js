const mongoose = require("mongoose")

const travelRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    estimatedCost: {
      type: Number,
      required: true,
      min: 0,
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
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
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
    documentUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("TravelRequest", travelRequestSchema)
