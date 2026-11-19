// Atualização em tempo real: quando alguém da família muda alguma coisa noutro telemóvel,
// a app recarrega os dados (agrupando várias alterações seguidas numa só atualização).
// Também atualiza quando a app volta a ficar visível (ex.: ao desbloquear o telemóvel).
import { watch } from 'vue'
import { supabase } from './supabase.js'
import { session } from './session.js'
import { catalog, loadCatalog } from './catalog.js'
import { rancho, loadRancho } from './rancho.js'
import { despesas, loadDespesas } from './despesas.js'

const TABLES = ['list_items', 'purchases', 'months', 'products', 'stores', 'categories',
  'fixed_expenses', 'month_expenses', 'extra_expenses']

let channel = null
let timer = null
let lastRefresh = 0

async function refresh() {
  lastRefresh = Date.now()
  try {
    if (catalog.loaded) await loadCatalog(true)
    if (rancho.loaded) await loadRancho(rancho.monthStart)
    if (despesas.loaded) await loadDespesas()
  } catch { /* sem rede: tenta na próxima alteração */ }
}
function schedule(delay = 700) {
  clearTimeout(timer)
  timer = setTimeout(refresh, delay)
}

function subscribe(hid) {
  if (channel) { supabase.removeChannel(channel); channel = null }
  if (!hid) return
  channel = supabase.channel(`familia-${hid}`)
  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` }, () => schedule())
  }
  channel.subscribe()
}

export function startRealtime() {
  if (!supabase) return
  watch(() => session.household?.id, (hid) => subscribe(hid), { immediate: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session.household && Date.now() - lastRefresh > 20000) schedule(0)
  })
}
