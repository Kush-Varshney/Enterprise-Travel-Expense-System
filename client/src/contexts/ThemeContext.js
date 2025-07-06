"use client"

import { createContext, useContext, useState, useEffect } from "react"

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme")
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (isDark) {
      root.classList.add("dark")
      document.documentElement.style.setProperty("--toast-bg", "#374151")
      document.documentElement.style.setProperty("--toast-color", "#f9fafb")
    } else {
      root.classList.remove("dark")
      document.documentElement.style.setProperty("--toast-bg", "#ffffff")
      document.documentElement.style.setProperty("--toast-color", "#111827")
    }
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
