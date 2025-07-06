const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "expense_submitted", "expense_approved", "expense_rejected",
        "travel_submitted", "travel_approved", "travel_rejected",
        "general", "user_pending_approval"
      ],
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
      enum: ["TravelRequest", "ExpenseClaim", "User"],
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Notification", notificationSchema)
