const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const User = require("../models/User")
const TravelRequest = require("../models/TravelRequest")
const ExpenseClaim = require("../models/ExpenseClaim")
const Notification = require("../models/Notification")
require("dotenv").config()

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log("Connected to MongoDB")

    await User.deleteMany({})
    await TravelRequest.deleteMany({})
    await ExpenseClaim.deleteMany({})
    await Notification.deleteMany({})
    console.log("Cleared existing data")

    const admin = await User.create({
      email: "admin@example.com",
      password: "admin123",
      firstName: "Admin",
      lastName: "1",
      role: "Admin",
      isActive: true,
      isPermanent: true,
    })
    console.log("Seeded: 1 Admin")

    // Add Manager
    const manager = await User.create({
      email: "manager@example.com",
      password: "manager123",
      firstName: "Manager",
      lastName: "1",
      role: "Manager",
      isActive: true,
      department: "Sales"
    })
    console.log("Seeded: 1 Manager")

    // Add Employee assigned to Manager
    const employee = await User.create({
      email: "employee@example.com",
      password: "employee123",
      firstName: "Employee",
      lastName: "1",
      role: "Employee",
      isActive: true,
      department: "Sales",
      manager: manager._id
    })
    console.log("Seeded: 1 Employee (assigned to Manager)")

    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    const existing = await User.findOne({ email: "admin2@example.com" })
    if (!existing) {
      await User.create({
        email: "admin2@example.com",
        password: "adminpass",
        firstName: "YourName",
        lastName: "YourLastName",
        role: "Admin",
        department: "IT",
      })
      console.log("Admin user created: admin2@example.com / adminpass")
    } else {
      console.log("Admin user already exists.")
    }
    await mongoose.disconnect()
    process.exit(0)
  } catch (error) {
    console.error("Error creating admin:", error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// Usage: node seed.js [admin]
if (process.argv[2] === 'admin') {
  seedAdmin()
} else {
  seedDatabase()
}
