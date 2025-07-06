"use client"

import { createContext, useContext, useReducer, useEffect } from "react"
import axios from "axios"
import toast from "react-hot-toast"

const AuthContext = createContext()

const initialState = {
  user: null,
  token: localStorage.getItem("token"),
  loading: true,
  isAuthenticated: false,
}

const authReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_SUCCESS":
    case "REGISTER_SUCCESS":
      localStorage.setItem("token", action.payload.token)
      return {
        ...state,
        user: {
          ...action.payload.user,
          profilePicture: makeAbsoluteProfilePicture(action.payload.user.profilePicture),
        },
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      }
    case "USER_LOADED":
      return {
        ...state,
        user: {
          ...action.payload.user,
          profilePicture: makeAbsoluteProfilePicture(action.payload.user.profilePicture),
        },
        isAuthenticated: true,
        loading: false,
      }
    case "AUTH_ERROR":
    case "LOGOUT":
      localStorage.removeItem("token")
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      }
    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload,
      }
    default:
      return state
  }
}

const makeAbsoluteProfilePicture = (profilePicture) => {
  if (!profilePicture) return undefined;
  if (profilePicture.startsWith('http')) return profilePicture;
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
  return `${backendUrl}${profilePicture}`;
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Set auth token in axios headers
  useEffect(() => {
    if (state.token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${state.token}`
    } else {
      delete axios.defaults.headers.common["Authorization"]
    }
  }, [state.token])

  // Load user on app start
  useEffect(() => {
    if (state.token) {
      loadUser()
    } else {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }, [])

  const loadUser = async () => {
    try {
      const res = await axios.get("/api/auth/me")
      dispatch({ type: "USER_LOADED", payload: res.data })
    } catch (error) {
      dispatch({ type: "AUTH_ERROR" })
    }
  }

  const login = async (credentials) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true })
      const res = await axios.post("/api/auth/login", credentials)
      // Set token in localStorage and axios headers BEFORE dispatch
      localStorage.setItem("token", res.data.token)
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`
      dispatch({ type: "LOGIN_SUCCESS", payload: res.data })
      await loadUser()
      const updatedUser = res.data.user
      if (updatedUser.role === 'Employee' && !updatedUser.isActive) {
        window.location.href = "/pending-approval"
        return { success: false, message: "User is not active. Please wait for approval." }
      }
      toast.success("Login successful!")
      return { success: true }
    } catch (error) {
      dispatch({ type: "AUTH_ERROR" })
      const message = error.response?.data?.message || "Login failed"
      toast.error(message)
      return { success: false, message }
    }
  }

  const register = async (userData) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true })
      const res = await axios.post("/api/auth/register", userData)
      dispatch({ type: "REGISTER_SUCCESS", payload: res.data })
      if (res.data.user.role === 'Employee' && !res.data.user.isActive) {
        window.location.href = "/pending-approval"
        return { success: false, message: "User is not active. Please wait for approval." }
      }
      toast.success("Registration successful!")
      return { success: true }
    } catch (error) {
      dispatch({ type: "AUTH_ERROR" })
      const message = error.response?.data?.message || "Registration failed"
      toast.error(message)
      return { success: false, message }
    }
  }

  const logout = () => {
    dispatch({ type: "LOGOUT" })
    toast.success("Logged out successfully")
  }

  const value = {
    ...state,
    login,
    register,
    logout,
    loadUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
