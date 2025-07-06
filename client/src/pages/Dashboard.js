"use client"

import { useState, useEffect } from "react"
import { MapIcon, CurrencyDollarIcon, CheckCircleIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useAuth } from "../contexts/AuthContext"
import LoadingSpinner from "../components/LoadingSpinner"
import axios from "axios"
import { useNavigate } from "react-router-dom"

// Utility to format date as DD/MM/YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const Dashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const res = await axios.get("/api/dashboard/stats")
      setStats(res.data)
      setError(null)
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
      setError("Failed to load dashboard data. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error}
      </div>
    )
  }

  const travelStatusData =
    stats?.travelStats?.map((stat) => ({
      name: stat._id,
      count: stat.count,
      amount: stat.totalCost,
    })) || []

  const expenseStatusData =
    stats?.expenseStats?.map((stat) => ({
      name: stat._id,
      count: stat.count,
      amount: stat.totalAmount,
    })) || []

  const monthlyData =
    stats?.monthlyExpenses
      ?.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
        amount: item.totalAmount,
        count: item.count,
      }))
      .reverse() || []

  const pieColors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"]

  const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
    <div className="card hover:shadow-strong transition-all duration-300 transform hover:-translate-y-1">
      <div className="card-body">
        <div className="flex items-center">
          <div className={`flex-shrink-0 p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-500">{subtitle}</p>}
          </div>
          {trend && (
            <div className="flex items-center text-green-600">
              <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
              <span className="text-sm font-medium">{trend}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const totalTravelRequests = travelStatusData.reduce((sum, item) => sum + item.count, 0)
  const totalExpenseClaims = expenseStatusData.reduce((sum, item) => sum + item.count, 0)
  const totalExpenseAmount = expenseStatusData.reduce((sum, item) => sum + item.amount, 0)
  const approvedExpenses = expenseStatusData.find((item) => item.name === "Approved")?.amount || 0

  const handleCardClick = (type) => {
    if (type === "travel") {
      navigate("/travel-requests")
    } else if (type === "expense") {
      navigate("/expense-claims")
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white shadow-strong">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.firstName}!</h1>
            <p className="text-primary-100 mt-1">Here's what's happening with your travel and expenses</p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <MapIcon className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => handleCardClick("travel")}
          className="cursor-pointer">
          <StatCard
            title="Travel Requests"
            value={totalTravelRequests}
            icon={MapIcon}
            color="bg-blue-500"
            subtitle="Total submitted"
          />
        </div>
        <div onClick={() => handleCardClick("expense")}
          className="cursor-pointer">
          <StatCard
            title="Expense Claims"
            value={totalExpenseClaims}
            icon={CurrencyDollarIcon}
            color="bg-green-500"
            subtitle="Total submitted"
          />
        </div>
        <StatCard
          title="Total Expenses"
          value={`$${totalExpenseAmount.toLocaleString()}`}
          icon={ArrowTrendingUpIcon}
          color="bg-purple-500"
          subtitle="All time"
        />
        <StatCard
          title="Approved Amount"
          value={`$${approvedExpenses.toLocaleString()}`}
          icon={CheckCircleIcon}
          color="bg-emerald-500"
          subtitle="This period"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Expenses Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Expense Trends</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              {monthlyData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No expense data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" className="text-gray-600 dark:text-gray-400" />
                    <YAxis className="text-gray-600 dark:text-gray-400" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--tooltip-bg)",
                        border: "none",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: "#3B82F6", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Expense Status Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Expense Status Distribution</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {expenseStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Travel Requests */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Travel Requests</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {stats?.recentTravelRequests?.length > 0 ? (
                stats.recentTravelRequests.map((request) => (
                  <div
                    key={request._id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center">
                      <MapIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{request.destination}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        request.status === "Approved"
                          ? "badge-approved"
                          : request.status === "Rejected"
                            ? "badge-rejected"
                            : "badge-pending"
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent travel requests</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Expense Claims */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Expense Claims</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {stats?.recentExpenseClaims?.length > 0 ? (
                stats.recentExpenseClaims.map((claim) => (
                  <div
                    key={claim._id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          ${claim.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {claim.travelRequest?.destination} • {formatDate(claim.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        claim.status === "Approved"
                          ? "badge-approved"
                          : claim.status === "Rejected"
                            ? "badge-rejected"
                            : "badge-pending"
                      }`}
                    >
                      {claim.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent expense claims</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
