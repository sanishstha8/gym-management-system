import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeState {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "shrawngym:theme"
const ThemeContext = createContext<ThemeState | null>(null)

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === "light" || v === "dark" || v === "system" ? v : "light"
  } catch {
    return "light"
  }
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches

/** Toggles the `dark` class on <html> and remembers the choice per browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored)
  const [prefersDark, setPrefersDark] = useState(systemDark)
  const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable; theme still applies for this session
    }
  }

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}
