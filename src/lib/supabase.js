import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://swyfcathwcdpgkirwihh.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWZjYXRod2NkcGdraXJ3aWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTA1MTAsImV4cCI6MjA4OTQyNjUxMH0.9plelXfU7k9Y3sJaLFpwWeDtPTfZQHadxpxBEHrPqog'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
})
