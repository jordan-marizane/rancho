import { reactive } from 'vue'
import { supabase } from './supabase.js'
import { session } from './session.js'
import { rancho } from './rancho.js'
import { today } from './format.js'

// Despesas fixas: modelos (repetem-se todos os meses) e as do mês atual
export const despesas = reactive({ loaded: false, templates: [], items: [] })

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
  despesas.loaded = true
}

// Nova despesa fixa: fica como modelo e entra já no mês atual
export async function addFixed({ name, amount, due_day }) {
  const tpl = check(await supabase.from('fixed_expenses').insert({
    household_id: hid(), name: name.trim(), amount: Number(amount), due_day: due_day || null,
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
