
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// AI calls happen in Supabase Edge Functions — no API keys are inlined
// into the client bundle. Client config uses VITE_SUPABASE_* env vars.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  }
});
