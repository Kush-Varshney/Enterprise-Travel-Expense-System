const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const compression = require("compression")
const path = require("path")
const http = require('http')
const { Server } = require('socket.io')

// Load environment variables
dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:3000",
    credentials: true,
  },
})

// Trust proxy for correct rate limiting and IP detection
app.set('trust proxy', 1)

// Security middleware
app.use(helmet())
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
// app.use("/api/", limiter)

// CORS configuration
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? process.env.CLIENT_URL : "http://localhost:3000",
    credentials: true,
  }),
)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Serve uploaded receipts statically
const uploadsPath = path.join(__dirname, "uploads");
if (!require('fs').readdirSync(uploadsPath).length) {
  console.warn("[WARNING] The uploads directory is empty. Uploaded files may be missing, causing 404 errors.");
}
app.use("/uploads", express.static(uploadsPath));

// Routes
app.use("/api/auth", require("./routes/auth"))
app.use("/api/travel", require("./routes/travel"))
app.use("/api/expense", require("./routes/expense"))
app.use("/api/notifications", require("./routes/notifications"))
app.use("/api/dashboard", require("./routes/dashboard"))
app.use("/api/users", require("./routes/users"))

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Track connected users by userId
const connectedUsers = {}
io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    if (userId) {
      connectedUsers[userId] = socket.id
    }
  })
  socket.on('disconnect', () => {
    for (const [userId, sockId] of Object.entries(connectedUsers)) {
      if (sockId === socket.id) {
        delete connectedUsers[userId]
        break
      }
    }
  })
})
app.set('io', io)
app.set('connectedUsers', connectedUsers)

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "Validation Error", errors: err.errors })
  }

  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format" })
  }

  res.status(500).json({
    message: process.env.NODE_ENV === "production" ? "Something went wrong!" : err.message,
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
})
