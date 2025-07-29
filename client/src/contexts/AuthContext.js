"use client";

import { createContext, useContext, useReducer, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const AuthContext = createContext();

// ✅ Define Backend URL from .env
const backendUrl = process.env.REACT_APP_BACKEND_URL || "https://enterprise-travel-expense-system.onrender.com";

const initialState = {
  user: null,
  token: localStorage.getItem("token"),
  loading: true,
  isAuthenticated: false,
};

// ✅ Helper to fix profilePicture path
const makeAbsoluteProfilePicture = (profilePicture) => {
  if (!profilePicture) return undefined;
  if (profilePicture.startsWith("http")) return profilePicture;
  return `${backendUrl}${profilePicture}`;
};

// ✅ Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_SUCCESS":
    case "REGISTER_SUCCESS":
      localStorage.setItem("token", action.payload.token);
      return {
        ...state,
        user: {
          ...action.payload.user,
          profilePicture: makeAbsoluteProfilePicture(action.payload.user.profilePicture),
          profilePicturePublicId: action.payload.user.profilePicturePublicId,
        },
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      };
    case "USER_LOADED":
      return {
        ...state,
        user: {
          ...action.payload.user,
          profilePicture: makeAbsoluteProfilePicture(action.payload.user.profilePicture),
          profilePicturePublicId: action.payload.user.profilePicturePublicId,
        },
        isAuthenticated: true,
        loading: false,
      };
    case "AUTH_ERROR":
    case "LOGOUT":
      localStorage.removeItem("token");
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };
    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload,
      };
    default:
      return state;
  }
};

// ✅ Context Provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ✅ Set default token header
  useEffect(() => {
    if (state.token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${state.token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [state.token]);

  // ✅ Load user on app start
  useEffect(() => {
    if (state.token) {
      loadUser();
    } else {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // ✅ Load user info
  const loadUser = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/auth/me`);
      dispatch({ type: "USER_LOADED", payload: res.data });
    } catch (error) {
      dispatch({ type: "AUTH_ERROR" });
    }
  };

  // ✅ Login handler
  const login = async (credentials) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      // Login API
      const res = await axios.post(`${backendUrl}/api/auth/login`, credentials);

      // Store token
      localStorage.setItem("token", res.data.token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;

      // Set placeholder user first
      dispatch({ type: "LOGIN_SUCCESS", payload: { token: res.data.token, user: {} } });

      // Fetch real user data
      const updatedUserRes = await axios.get(`${backendUrl}/api/auth/me`);
      const updatedUser = updatedUserRes.data.user;
      dispatch({ type: "USER_LOADED", payload: { user: updatedUser } });

      // Redirect if inactive
      if (updatedUser.role === "Employee" && !updatedUser.isActive) {
        window.location.href = "/pending-approval";
        return { success: false, message: "User is not active. Please wait for approval." };
      }

      toast.success("Login successful!");
      return { success: true };

    } catch (error) {
      dispatch({ type: "AUTH_ERROR" });
      const message = error.response?.data?.message || "Login failed";
      toast.error(message);
      return { success: false, message };
    }
  };

  // ✅ Register handler
  const register = async (userData) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const res = await axios.post(`${backendUrl}/api/auth/register`, userData);
      dispatch({ type: "REGISTER_SUCCESS", payload: res.data });

      if (res.data.user.role === "Employee" && !res.data.user.isActive) {
        window.location.href = "/pending-approval";
        return { success: false, message: "User is not active. Please wait for approval." };
      }

      toast.success("Registration successful!");
      return { success: true };
    } catch (error) {
      dispatch({ type: "AUTH_ERROR" });
      const message = error.response?.data?.message || "Registration failed";
      toast.error(message);
      return { success: false, message };
    }
  };

  // ✅ Logout handler
  const logout = () => {
    dispatch({ type: "LOGOUT" });
    toast.success("Logged out successfully");
  };

  // ✅ Manual user update
  const updateUser = (userUpdate) => {
    const updatedUser = { ...state.user, ...userUpdate };
    if (userUpdate.hasOwnProperty("profilePicture")) {
      updatedUser.profilePicture = makeAbsoluteProfilePicture(userUpdate.profilePicture);
    }
    dispatch({ type: "USER_LOADED", payload: { user: updatedUser } });
  };

  // ✅ Final context value
  const value = {
    ...state,
    login,
    register,
    logout,
    loadUser,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ✅ Hook to use Auth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
