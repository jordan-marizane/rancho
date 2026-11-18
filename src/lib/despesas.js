import { reactive } from 'vue'
import { supabase } from './supabase.js'
import { session } from './session.js'
import { rancho } from './rancho.js'
import { today } from './format.js'

// Despesas fixas: modelos (repetem-se todos os meses) e as do mês atual
export const despesas = reactive({ loaded: false, templates: [], items: [], extras: [], extrasReady: true })

// Categorias das despesas que aparecem durante o mês
export const EXTRA_CATS = [
  { id: 'energia', label: 'Energia', icon: '⚡' },
  { id: 'casa', label: 'Casa e reparações', icon: '🔧' },
  { id: 'saude', label: 'Saúde', icon: '💊' },
  { id: 'transporte', label: 'Transporte', icon: '🚗' },
  { id: 'criancas', label: 'Crianças', icon: '🧒' },
  { id: 'ofertas', label: 'Ofertas e festas', icon: '🎁' },
  { id: 'outros', label: 'Outros', icon: '📌' },
]
export const extraCat = (id) => EXTRA_CATS.find((c) => c.id === id) ?? EXTRA_CATS[EXTRA_CATS.length - 1]

function check({ data, error }) {
  if (error) throw error
  return data
}
const hid = () => session.household.id

export async function loadDespesas() {
  const [t, i] = await Promise.all([
    supabase.from('fixed_expenses').select('*').eq('household_id', hid()).eq('active', true).order('due_day', { nullsFirst: false }).order('name'),
    rancho.month
      ? supabase.from('month_expenses').select('*').eq('month_id', rancho.month.id).order('due_day', { nullsFirst: false }).order('name')
      : Promise.resolve({ data: [] }),
  ])
  despesas.templates = check(t)
  despesas.items = check(i)
  await loadExtras()
  despesas.loaded = true
}

// Despesas do mês fora das fixas. Se a base de dados ainda não tiver a tabela (falta a
// migração 006), o resto da app continua a funcionar.
async function loadExtras() {
  if (!rancho.month) { despesas.extras = []; return }
  const { data, error } = await supabase.from('extra_expenses').select('*').eq('month_id', rancho.month.id)
    .order('spent_on', { ascending: false }).order('created_at', { ascending: false })
  if (error) {
    if (/extra_expenses/i.test(error.message)) { despesas.extras = []; despesas.extrasReady = false; return }
    throw error
  }
  despesas.extras = data
  despesas.extrasReady = true
}

// A conta varia de mês para mês (água, energia…)?
export const isVariable = (item) => !!despesas.templates.find((t) => t.id === item.fixed_expense_id)?.variable

// Pagar uma conta de valor variável: guarda o valor real e passa a ser a estimativa do mês seguinte
export async function payVariable(item, amount) {
  check(await supabase.from('month_expenses').update({ amount, paid_at: new Date().toISOString() }).eq('id', item.id))
  if (item.fixed_expense_id) check(await supabase.from('fixed_expenses').update({ amount }).eq('id', item.fixed_expense_id))
  await loadDespesas()
}

export async function setVariable(item, variable) {
  if (!item.fixed_expense_id) return
  check(await supabase.from('fixed_expenses').update({ variable }).eq('id', item.fixed_expense_id))
}

export async function addExtra({ name, amount, category, spent_on }) {
  check(await supabase.from('extra_expenses').insert({
    household_id: hid(), month_id: rancho.month.id, name: name.trim(), amount, category, spent_on: spent_on || today(),
  }))
  await loadExtras()
}

export async function updateExtra(id, fields) {
  check(await supabase.from('extra_expenses').update(fields).eq('id', id))
  await loadExtras()
}

export async function removeExtra(id) {
  check(await supabase.from('extra_expenses').delete().eq('id', id))
  await loadExtras()
}

export function extraSummary() {
  const total = despesas.extras.reduce((s, e) => s + Number(e.amount), 0)
  const reserve = rancho.month?.reserve_budget != null ? Number(rancho.month.reserve_budget) : null
  return { total, reserve, left: reserve != null ? reserve - total : null, count: despesas.extras.length, byCat: byCategory(despesas.extras) }
}

export function byCategory(extras) {
  const m = {}
  for (const e of extras) m[e.category] = (m[e.category] ?? 0) + Number(e.amount)
  return Object.entries(m).map(([id, value]) => ({ ...extraCat(id), value })).sort((a, b) => b.value - a.value)
}

// Nova despesa fixa: fica como modelo e entra já no mês atual
export async function addFixed({ name, amount, due_day, variable = false }) {
  const tpl = check(await supabase.from('fixed_expenses').insert({
    household_id: hid(), name: name.trim(), amount: Number(amount), due_day: due_day || null,
    ...(variable ? { variable: true } : {}),
  }).select().single())
  if (rancho.month) {
    check(await supabase.from('month_expenses').insert({
      household_id: hid(), month_id: rancho.month.id, fixed_expense_id: tpl.id,
      name: tpl.name, amount: tpl.amount, due_day: tpl.due_day,
    }))
  }
  await loadDespesas()
}

// Alterar só este mês (ex.: combustível foi mais) ou também os meses seguintes
export async function updateMonthItem(item, fields, alsoTemplate = false) {
  check(await supabase.from('month_expenses').update(fields).eq('id', item.id))
  if (alsoTemplate && item.fixed_expense_id) {
    check(await supabase.from('fixed_expenses').update(fields).eq('id', item.fixed_expense_id))
  }
  await loadDespesas()
}

export async function togglePaid(item) {
  check(await supabase.from('month_expenses').update({ paid_at: item.paid_at ? null : new Date().toISOString() }).eq('id', item.id))
  await loadDespesas()
}

// Remove deste mês e, se pedido, deixa de se repetir
export async function removeItem(item, stopRepeating) {
  check(await supabase.from('month_expenses').delete().eq('id', item.id))
  if (stopRepeating && item.fixed_expense_id) {
    check(await supabase.from('fixed_expenses').update({ active: false }).eq('id', item.fixed_expense_id))
  }
  await loadDespesas()
}

export function fixedSummary() {
  const total = despesas.items.reduce((s, i) => s + Number(i.amount), 0)
  const paid = despesas.items.filter((i) => i.paid_at).reduce((s, i) => s + Number(i.amount), 0)
  const day = Number(today().slice(8, 10))
  const isCurrent = rancho.monthStart === `${today().slice(0, 7)}-01`
  const late = despesas.items.filter((i) => !i.paid_at && i.due_day && isCurrent && i.due_day < day)
  const next = despesas.items.filter((i) => !i.paid_at).slice(0, 3)
  return { total, paid, unpaid: total - paid, late, next, count: despesas.items.length, paidCount: despesas.items.filter((i) => i.paid_at).length }
}
