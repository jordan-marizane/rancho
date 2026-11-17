import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Enquanto o Supabase não estiver configurado, a app abre na mesma
// e mostra um aviso, em vez de falhar.
export const supabase = url && key ? createClient(url, key) : null
export const isConfigured = Boolean(supabase)
