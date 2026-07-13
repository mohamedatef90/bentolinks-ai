import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://sjskpjgepbvblojohtlr.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqc2twamdlcGJ2Ymxvam9odGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzIzMzYsImV4cCI6MjA4NDU0ODMzNn0.x17WuelrlAXL_5UCyWo2FfD5BkH7IrPJbPWa9c125fY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
