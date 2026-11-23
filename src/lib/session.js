import { reactive } from 'vue'
import { supabase } from './supabase.js'

// Estado global da sessão: utilizador, família e membros
export const session = reactive({
  ready: false,
  user: null,
  household: null,
  member: null,
  members: [],
  recovering: false, // a pessoa abriu o link de "esqueci a palavra-passe"
})

let started = false

export async function initSession() {
  if (!supabase || started) { session.ready = true; return }
  started = true
  const { data } = await supabase.auth.getSession()
  await setUser(data.session?.user ?? null)
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === 'PASSWORD_RECOVERY') session.recovering = true
    // Evita chamadas ao Supabase dentro do callback (recomendação do supabase-js)
    setTimeout(() => setUser(s?.user ?? null), 0)
  })
  session.ready = true
}

async function setUser(user) {
  if (user?.id === session.user?.id && session.household) return
  session.user = user
  if (user) await loadHousehold()
  else Object.assign(session, { household: null, member: null, members: [] })
}

export async function loadHousehold() {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, display_name, role, households(id, name, invite_code, currency)')
    .eq('user_id', session.user.id)
    .order('joined_at')
    .limit(1)
  if (error) throw error
  const row = data?.[0]
  session.member = row ? { display_name: row.display_name, role: row.role } : null
  session.household = row?.households ?? null
  if (session.household) await loadMembers()
}

export async function loadMembers() {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, display_name, role, joined_at')
    .eq('household_id', session.household.id)
    .order('joined_at')
  if (error) throw error
  session.members = data
}

// Nome de um membro da família. Se for alguém que entrou depois de esta app abrir,
// recarrega a lista de membros (uma vez de cada vez) e o nome aparece logo a seguir.
let reloadingMembers = false
export function memberName(userId) {
  const m = session.members.find((x) => x.user_id === userId)
  if (m) return m.display_name
  if (userId && session.household && !reloadingMembers) {
    reloadingMembers = true
    loadMembers().catch(() => {}).finally(() => setTimeout(() => { reloadingMembers = false }, 30000))
  }
  return '—'
}

export function displayNameFromUser() {
  return session.user?.user_metadata?.display_name || session.user?.email?.split('@')[0] || ''
}

export async function signOut() {
  await supabase.auth.signOut()
}
