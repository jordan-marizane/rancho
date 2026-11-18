import { supabase } from './supabase.js'
import { session } from './session.js'
import { catalog, storeName, categoryName } from './catalog.js'
import { memberName } from './session.js'

function check({ data, error }) {
  if (error) throw error
  return data
}
const total = (p) => Number(p.price) * Number(p.quantity)

export async function loadMonths() {
  return check(await supabase.from('months').select('*').eq('household_id', session.household.id).order('month'))
}

export async function loadMonthExpenses(monthId) {
  return check(await supabase.from('month_expenses').select('*').eq('month_id', monthId).order('due_day', { nullsFirst: false }))
}

export const ranchoSpent = (monthId) =>
  catalog.purchases.filter((p) => p.month_id === monthId).reduce((s, p) => s + total(p), 0)

// Resumo completo de um mês. "prev" é a linha do mês anterior (ou null).
export function monthSummary(month, prev, expenses) {
  const start = month.month
  const purchases = catalog.purchases.filter((p) => p.month_id === month.id)
  const spentRancho = purchases.reduce((s, p) => s + total(p), 0)
  const fixedTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const fixedPaid = expenses.filter((e) => e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const spentTotal = spentRancho + fixedPaid
  const prevRancho = prev ? ranchoSpent(prev.id) : null

  // Comparação de preços: cada produto comprado este mês vs o último preço antes deste mês
  const changes = []
  let priceEffect = 0 // >0 = pagaram mais por causa de subidas; <0 = pouparam com preços mais baixos
  const seen = new Set()
  for (const p of purchases) {
    if (seen.has(p.product_id)) continue
    seen.add(p.product_id)
    const ref = catalog.purchases.find((x) => x.product_id === p.product_id && x.purchased_on < start)
    if (!ref) continue
    const diff = Number(p.price) - Number(ref.price)
    priceEffect += diff * Number(p.quantity)
    if (Math.abs(diff) >= 0.005) {
      const product = catalog.products.find((x) => x.id === p.product_id)
      changes.push({ name: product?.name ?? '—', from: Number(ref.price), to: Number(p.price), diff,
        pct: Number(ref.price) ? diff / Number(ref.price) : 0, store: storeName(p.store_id), refStore: storeName(ref.store_id) })
    }
  }
  const up = changes.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff)
  const down = changes.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff)

  const byStore = {}
  for (const p of purchases) byStore[storeName(p.store_id)] = (byStore[storeName(p.store_id)] ?? 0) + total(p)
  const stores = Object.entries(byStore).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  return {
    spentRancho, fixedTotal, fixedPaid, spentTotal, prevRancho,
    budgetTotal: month.total_budget != null ? Number(month.total_budget) : null,
    budgetRancho: month.rancho_budget != null ? Number(month.rancho_budget) : null,
    priceEffect, up, down, stores, unpaid: expenses.filter((e) => !e.paid_at),
  }
}

// Sugestão de orçamento do rancho: 5% abaixo do que gastaram no mês anterior,
// arredondado para baixo aos 500 MT
export function suggestRanchoBudget(prevSpent) {
  if (!prevSpent) return null
  return Math.floor((prevSpent * 0.95) / 500) * 500
}

// ---------- Exportação CSV (abre no Excel em português) ----------
const cell = (v) => {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function download(filename, rows) {
  const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function exportPurchases() {
  const prodById = Object.fromEntries(catalog.products.map((p) => [p.id, p]))
  const rows = [['Data', 'Produto', 'Categoria', 'Loja', 'Preço (MT)', 'Quantidade', 'Total (MT)', 'Registado por']]
  for (const p of [...catalog.purchases].reverse()) {
    const prod = prodById[p.product_id]
    rows.push([p.purchased_on, prod?.name ?? '(removido)', categoryName(prod?.category_id), storeName(p.store_id),
      Number(p.price), Number(p.quantity), total(p), memberName(p.created_by)])
  }
  download(`rancho-compras-${new Date().toISOString().slice(0, 10)}.csv`, rows)
}

export async function exportExpenses() {
  const months = await loadMonths()
  const rows = [['Mês', 'Despesa', 'Valor (MT)', 'Dia', 'Paga', 'Paga por', 'Data do pagamento']]
  for (const m of months) {
    for (const e of await loadMonthExpenses(m.id)) {
      rows.push([m.month.slice(0, 7), e.name, Number(e.amount), e.due_day, e.paid_at ? 'Sim' : 'Não',
        e.paid_by ? memberName(e.paid_by) : '', e.paid_at ? e.paid_at.slice(0, 10) : ''])
    }
  }
  download(`rancho-despesas-fixas-${new Date().toISOString().slice(0, 10)}.csv`, rows)
}
