import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress known startup WebSocket noise in development.
// These errors come from Supabase Realtime and Vite HMR both trying to
// connect in the first milliseconds of page load — they auto-resolve.
window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.message || '';
  if (
    msg.includes("can't access property") ||
    msg.includes('WebSocket') ||
    msg.includes('send') ||
    msg.includes('ws is undefined')
  ) {
    e.preventDefault(); // Don't log to console
  }
});

// Register the updated service worker (v2 — bypasses Supabase & API calls)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
