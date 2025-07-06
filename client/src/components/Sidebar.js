"use client"
import { NavLink, useLocation } from "react-router-dom"
import { HomeIcon, MapIcon, CurrencyDollarIcon, BellIcon, UserIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { DocumentTextIcon } from "@heroicons/react/24/outline"
import { useAuth } from "../contexts/AuthContext"

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth()
  const location = useLocation()

  let navigation = []
  if (user?.role === "Employee") {
    navigation = [
      { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
      { name: "Travel Requests", href: "/travel-requests", icon: MapIcon },
      { name: "Expense Claims", href: "/expense-claims", icon: CurrencyDollarIcon },
      { name: "Notifications", href: "/notifications", icon: BellIcon },
      { name: "Profile", href: "/profile", icon: UserIcon },
    ]
  } else if (user?.role === "Manager") {
    navigation = [
      { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
      { name: "Travel Requests", href: "/travel-requests", icon: MapIcon },
      { name: "Approvals", href: "/approvals", icon: MapIcon },
      { name: "Expense Claims", href: "/expense-claims", icon: CurrencyDollarIcon },
      { name: "Notifications", href: "/notifications", icon: BellIcon },
      { name: "Profile", href: "/profile", icon: UserIcon },
    ]
  } else if (user?.role === "Admin") {
    navigation = [
      { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
      { name: "Travel Requests", href: "/travel-requests", icon: MapIcon },
      { name: "User Management", href: "/users", icon: UserIcon },
      { name: "Expense Claims", href: "/expense-claims", icon: CurrencyDollarIcon },
      { name: "Notifications", href: "/notifications", icon: BellIcon },
      { name: "Audit Log", href: "/audit-log", icon: DocumentTextIcon },
      { name: "Profile", href: "/profile", icon: UserIcon },
    ]
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl border-r border-white/20 dark:border-gray-700/50 transform transition-all duration-500 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        {/* Sidebar Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/60 to-white/40 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-gray-800/40"></div>
        
        <div className="relative z-10 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/50">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <MapIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  T&E System
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Enterprise</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-300 transform hover:scale-105 lg:hidden glass"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 mt-6 px-4">
            <div className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={`
                      group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 relative overflow-hidden
                      ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-xl"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 hover:text-gray-900 dark:hover:text-white"
                      }
                    `}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 animate-pulse"></div>
                    )}
                    
                    <item.icon
                      className={`
                        mr-3 h-5 w-5 transition-all duration-300
                        ${
                          isActive
                            ? "text-white"
                            : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                        }
                      `}
                    />
                    <span className="relative z-10">{item.name}</span>
                    
                    {isActive && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse shadow-lg"></div>
                    )}
                    
                    {/* Hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  </NavLink>
                )
              })}
            </div>
          </nav>

          {/* User info at bottom */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-gray-50/30 to-gray-100/30 dark:from-gray-800/30 dark:to-gray-700/30">
            <div className="flex items-center p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/30 dark:border-gray-700/30">
              <div className="flex-shrink-0 relative">
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="avatar" className="w-10 h-10 rounded-full object-cover border-2 border-white/50 dark:border-gray-600/50 shadow-md" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 rounded-full flex items-center justify-center shadow-md">
                    <UserIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{user?.role}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">{user?.department}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
