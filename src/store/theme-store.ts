import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(theme);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        applyThemeClass(next);
        set({ theme: next });
      },
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
    }),
    { name: "wave-theme" }
  )
);

// Initialize HTML class from persisted storage on module load
const stored = localStorage.getItem("wave-theme");
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.state?.theme) {
      applyThemeClass(parsed.state.theme);
    }
  } catch {
    applyThemeClass("dark");
  }
} else {
  applyThemeClass("dark");
}
