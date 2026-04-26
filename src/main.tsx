import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Force-clear any stuck loading state
try {
  const storage = localStorage.getItem('auth-storage');
  if (storage) {
    const parsed = JSON.parse(storage);
    if (parsed.state) { parsed.state.loading = false; localStorage.setItem('auth-storage', JSON.stringify(parsed)); }
  }
} catch (e) {}

// Register service worker for notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
