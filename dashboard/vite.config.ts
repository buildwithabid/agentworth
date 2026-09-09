import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // a build with these unset ships a bundle that throws before React mounts, so
  // /dashboard/ goes blank in production with nothing in the build log. that
  // happened on 2026-09-07. fail here instead, where it is visible.
  const env = loadEnv(mode, '.', 'VITE_')
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(' and ')}. Copy dashboard/.env.example to dashboard/.env before building.`,
    )
  }

  return {
    plugins: [react(), tailwindcss()],
    // relative base so the static build works from any path (root or /dashboard/)
    base: './',
  }
})
