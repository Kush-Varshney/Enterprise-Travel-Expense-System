"use client"

import { useState, useEffect, useRef } from "react"
import { Bars3Icon, BellIcon, SunIcon, MoonIcon, UserCircleIcon } from "@heroicons/react/24/outline"
import { useAuth } from "../contexts/AuthContext"
import { useTheme } from "../contexts/ThemeContext"
import axios from "axios"
import { io } from "socket.io-client"
import { useNotifications } from "../contexts/NotificationContext"
import { useNavigate } from "react-router-dom"

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { unreadCount, loading: notifLoading } = useNotifications()
  const [showProfile, setShowProfile] = useState(false)
  const navigate = useNavigate()

  return (
    <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-xl border-b border-white/20 dark:border-gray-700/50 relative z-20">
      {/* Header Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/80 to-white/70 dark:from-gray-800/90 dark:via-gray-800/80 dark:to-gray-800/70"></div>
      
      <div className="px-6 py-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="p-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-300 transform hover:scale-105 lg:hidden glass"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            <div className="ml-4 lg:ml-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Travel & Expense
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enterprise Management System</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gradient-to-r hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/50 dark:hover:to-purple-900/50 transition-all duration-300 transform hover:scale-105 glass"
            >
              {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => navigate("/notifications")}
                className="p-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gradient-to-r hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/50 dark:hover:to-orange-900/50 transition-all duration-300 transform hover:scale-105 relative glass"
              >
                <BellIcon className="h-5 w-5" />
                {notifLoading ? (
                  <span className="absolute -top-1 -right-1 bg-gray-300 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse shadow-lg border-2 border-white dark:border-gray-800">
                    ...
                  </span>
                ) : unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse shadow-lg border-2 border-white dark:border-gray-800">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center space-x-3 p-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gradient-to-r hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/50 dark:hover:to-cyan-900/50 transition-all duration-300 transform hover:scale-105 glass"
              >
                {user?.profilePicture ? (
                  <div className="relative">
                    <img src={user.profilePicture} alt="avatar" className="h-8 w-8 rounded-full object-cover border-2 border-white/50 dark:border-gray-600/50 shadow-md" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  </div>
                ) : (
                  <div className="relative">
                    <UserCircleIcon className="h-8 w-8" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white block">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {user?.role}
                  </span>
                </div>
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-3 w-64 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 dark:border-gray-700/30 z-50 animate-scale-in overflow-hidden">
                  <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/50">
                    <div className="flex items-center space-x-3">
                      {user?.profilePicture ? (
                        <img src={user.profilePicture} alt="avatar" className="h-12 w-12 rounded-full object-cover border-2 border-white/50 dark:border-gray-600/50 shadow-lg" />
                      ) : (
                        <UserCircleIcon className="h-12 w-12 text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{user?.role}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">{user?.department}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 dark:hover:from-red-900/20 dark:hover:to-pink-900/20 rounded-xl transition-all duration-300 font-medium"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
