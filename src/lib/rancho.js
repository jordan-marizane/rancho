import { reactive } from 'vue'
import { supabase } from './supabase.js'
import { session } from './session.js'
import { catalog, loadCatalog } from './catalog.js'
import { today } from './format.js'

// Estado do rancho do mês atual
export const rancho = reactive({
  loaded: false,
  monthStart: null, // 'AAAA-MM-01'
  month: null,      // linha da tabela months (ou null se ainda não foi aberto)
  items: [],        // list_items do mês
})

function check({ data, error }) {
  if (error) throw error
  return data
}

export const currentMonthStart = () => `${today().slice(0, 7)}-01`

export async function loadRancho(monthStart = currentMonthStart()) {
  const hid = session.household.id
  await loadCatalog()
  rancho.monthStart = monthStart
  const month = check(await supabase.from('months').select('*').eq('household_id', hid).eq('month', monthStart).maybeSingle())
  const items = month
    ? check(await supabase.from('list_items').select('*').eq('month_id', month.id))
    : []
  rancho.month = month
  rancho.items = items
  rancho.loaded = true
}

export async function refreshAll() {
  await loadCatalog(true)
  await loadRancho(rancho.monthStart ?? currentMonthStart())
}

// Abre o mês: copia a lista, o orçamento e as despesas fixas do mês anterior.
// Opções: keep = ids dos produtos a levar (os outros saem da lista),
//         goal = meta de poupança do rancho, budget = limite do rancho.
export async function startMonth({ keep = null, goal = null, budget } = {}) {
  const monthId = check(await supabase.rpc('start_month', { hid: session.household.id, p_month: rancho.monthStart }))
  if (keep) {
    const items = check(await supabase.from('list_items').select('id, product_id').eq('month_id', monthId))
    const drop = items.filter((i) => !keep.has(i.product_id)).map((i) => i.id)
    for (let i = 0; i < drop.length; i += 100) {
      check(await supabase.from('list_items').delete().in('id', drop.slice(i, i + 100)))
    }
  }
  const fields = {}
  // A reserva para imprevistos passa do mês anterior (a função start_month ainda não a copia)
  const [{ data: cur }, { data: prev }] = await Promise.all([
    supabase.from('months').select('*').eq('id', monthId).maybeSingle(),
    supabase.from('months').select('*').eq('household_id', session.household.id).lt('month', rancho.monthStart)
      .order('month', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (cur && 'reserve_budget' in cur && cur.reserve_budget == null && prev?.reserve_budget != null) fields.reserve_budget = prev.reserve_budget
  if (goal != null) fields.savings_goal = goal
  if (budget !== undefined) fields.rancho_budget = budget
  if (Object.keys(fields).length) check(await supabase.from('months').update(fields).eq('id', monthId))
  await loadRancho(rancho.monthStart)
}

// O mês anterior (o mais recente antes deste) e a lista dele, para escolher o que levar
export async function loadPrevPlan() {
  const prev = check(await supabase.from('months').select('*').eq('household_id', session.household.id)
    .lt('month', rancho.monthStart).order('month', { ascending: false }).limit(1).maybeSingle())
  const items = prev ? check(await supabase.from('list_items').select('*').eq('month_id', prev.id)) : []
  return { prev, items }
}

export async function setGoal(goal, budget) {
  check(await supabase.from('months').update({ savings_goal: goal, rancho_budget: budget }).eq('id', rancho.month.id))
  rancho.month.savings_goal = goal
  rancho.month.rancho_budget = budget
}

export async function setBudget(value) {
  check(await supabase.from('months').update({ rancho_budget: value === '' ? null : Number(value) }).eq('id', rancho.month.id))
  rancho.month.rancho_budget = value === '' ? null : Number(value)
}

export async function setReserve(value) {
  const v = value === '' || value == null ? null : Number(value)
  check(await supabase.from('months').update({ reserve_budget: v }).eq('id', rancho.month.id))
  rancho.month.reserve_budget = v
}

export async function setTotalBudget(value) {
  const v = value === '' || value == null ? null : Number(value)
  check(await supabase.from('months').update({ total_budget: v }).eq('id', rancho.month.id))
  rancho.month.total_budget = v
}

export async function addToList(productId, storeId = null, qty = 1, plannedPrice = null) {
  // upsert: um produto removido e recuperado pode ainda ter a linha deste mês
  const row = check(await supabase.from('list_items').upsert({
    household_id: session.household.id, month_id: rancho.month.id, product_id: productId,
    planned_qty: qty, store_id: storeId, ...(plannedPrice != null ? { planned_price: plannedPrice } : {}),
  }, { onConflict: 'month_id,product_id' }).select().single())
  rancho.items = [...rancho.items.filter((i) => i.id !== row.id), row]
  return row
}

export async function updateItem(id, fields) {
  const row = check(await supabase.from('list_items').update(fields).eq('id', id).select().single())
  const i = rancho.items.findIndex((x) => x.id === id)
  if (i >= 0) rancho.items[i] = row
}

export async function removeFromList(id) {
  check(await supabase.from('list_items').delete().eq('id', id))
  rancho.items = rancho.items.filter((x) => x.id !== id)
}

// Regista o preço e marca o produto como comprado
export async function buy(item, { price, quantity, store_id, purchased_on }) {
  const product = catalog.products.find((p) => p.id === item.product_id)
  const row = check(await supabase.from('purchases').insert({
    household_id: session.household.id, product_id: item.product_id, month_id: rancho.month.id,
    store_id: store_id || null, price, quantity, pack_size: product?.pack_size || 1, purchased_on,
  }).select().single())
  catalog.purchases.unshift(row)
  catalog.purchases.sort((a, b) => (b.purchased_on.localeCompare(a.purchased_on)) || b.created_at.localeCompare(a.created_at))
  await updateItem(item.id, { done: true, store_id: store_id || item.store_id })
  return row
}

// Desfaz: apaga as compras deste produto neste mês e desmarca
export async function unbuy(item) {
  check(await supabase.from('purchases').delete().eq('month_id', rancho.month.id).eq('product_id', item.product_id))
  catalog.purchases = catalog.purchases.filter((p) => !(p.month_id === rancho.month.id && p.product_id === item.product_id))
  await updateItem(item.id, { done: false })
}

// ---------- Cálculos ----------
const total = (p) => Number(p.price) * Number(p.quantity)

// Compras deste produto neste mês
export const boughtThisMonth = (productId) =>
  catalog.purchases.filter((p) => p.month_id === rancho.month?.id && p.product_id === productId)

// Preço de referência: a compra mais recente ANTES deste mês, ou um preço registado à parte
// (em Produtos, sem ser compra do rancho) mesmo que seja deste mês
// No mesmo dia, uma compra real ganha a um preço visto noutra loja.
export function lastBefore(productId, monthStart = rancho.monthStart) {
  const c = catalog.purchases.filter((p) => p.product_id === productId && (p.purchased_on < monthStart || p.month_id == null))
  if (!c.length) return null
  return c.find((p) => p.purchased_on === c[0].purchased_on && p.month_id != null) ?? c[0]
}

// Preço esperado de um produto da lista: o previsto (escrito em casa) ou o de referência
export function expectedPrice(item) {
  if (item.planned_price != null) return Number(item.planned_price)
  const ref = lastBefore(item.product_id)
  return ref ? Number(ref.price) : null
}

// Guarda a previsão (quantidade e preço) sem marcar como comprado.
// Se o preço for igual ao de referência, não guarda previsão: continua a seguir a referência.
export async function savePlan(item, { qty, price }) {
  const ref = lastBefore(item.product_id)
  const planned = price == null || (ref && Math.abs(Number(ref.price) - price) < 0.005) ? null : price
  await updateItem(item.id, { planned_qty: qty, planned_price: planned })
}

// Produtos da lista que não foram removidos (um produto removido continua na lista, mas escondido)
export const activeItems = () => {
  const ids = new Set(catalog.products.map((p) => p.id))
  return rancho.items.filter((i) => ids.has(i.product_id))
}

export function summary() {
  const items = activeItems()
  const monthPurchases = catalog.purchases.filter((p) => p.month_id === rancho.month?.id)
  const spent = monthPurchases.reduce((s, p) => s + total(p), 0)
  const spentToday = monthPurchases.filter((p) => p.purchased_on === today()).reduce((s, p) => s + total(p), 0)
  let estimate = 0
  let missingPrice = 0
  for (const it of items) {
    const bought = boughtThisMonth(it.product_id)
    if (bought.length) { estimate += bought.reduce((s, p) => s + total(p), 0); continue }
    const price = expectedPrice(it)
    if (price != null) estimate += price * Number(it.planned_qty)
    else missingPrice++
  }
  const done = items.filter((i) => i.done || boughtThisMonth(i.product_id).length).length
  return { spent, spentToday, estimate, missingPrice, done, count: items.length }
}
