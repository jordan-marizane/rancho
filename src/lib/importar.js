import { supabase } from './supabase.js'
import { session } from './session.js'
import { loadCatalog } from './catalog.js'
import { STORES, CATEGORIES, MONTHS } from '../data/lista-inicial.js'

function check({ data, error }) {
  if (error) throw error
  return data
}

// Importa a lista inicial (lojas, categorias, produtos, preços e a lista do rancho).
// Só corre numa família sem produtos, para não duplicar nada.
export async function importInitialList(onProgress = () => {}) {
  const hid = session.household.id
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('household_id', hid)
  if (count > 0) throw new Error('Esta família já tem produtos: a importação só é feita uma vez.')

  onProgress('Lojas…')
  const existing = check(await supabase.from('stores').select('id, name').eq('household_id', hid))
  const missing = STORES.filter((s) => !existing.some((e) => e.name.toLowerCase() === s.name.toLowerCase()))
  if (missing.length) check(await supabase.from('stores').insert(missing.map((s) => ({ household_id: hid, ...s }))))
  const stores = check(await supabase.from('stores').select('id, name').eq('household_id', hid))
  const storeId = (name) => stores.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id ?? null

  onProgress('Categorias…')
  const cats = check(await supabase.from('categories')
    .insert(CATEGORIES.map((c, i) => ({ household_id: hid, name: c.name, sort_order: i + 1 })))
    .select('id, name'))
  const catId = (name) => cats.find((c) => c.name === name).id

  onProgress('Produtos…')
  const rows = CATEGORIES.flatMap((c) => c.items.map(([name]) => ({ household_id: hid, name, category_id: catId(c.name) })))
  const products = check(await supabase.from('products').insert(rows).select('id, name'))
  const prodId = (name) => products.find((p) => p.name === name).id

  onProgress('Meses e lista do rancho…')
  const mOld = check(await supabase.rpc('start_month', { hid, p_month: MONTHS.anterior }))
  check(await supabase.from('list_items').insert(CATEGORIES.flatMap((c) => c.items.map(([name, , , o = {}]) => ({
    household_id: hid, month_id: mOld, product_id: prodId(name),
    planned_qty: o.qty ?? 1, store_id: storeId(o.store ?? c.store),
  })))))

  onProgress('Preços…')
  const purchases = []
  for (const c of CATEGORIES) {
    for (const [name, prev, last, o = {}] of c.items) {
      const base = { household_id: hid, product_id: prodId(name), quantity: o.qty ?? 1 }
      const store = storeId(o.store ?? c.store)
      if (prev != null) purchases.push({ ...base, store_id: store, price: prev, purchased_on: MONTHS.anterior, month_id: mOld })
      if (last != null) purchases.push({ ...base, store_id: store, price: last, purchased_on: MONTHS.recente, _recent: true })
      // Preço visto noutra loja: entra no histórico, mas não conta como gasto do mês
      if (o.alt) purchases.push({ ...base, store_id: storeId(o.alt[0]), price: o.alt[1], purchased_on: MONTHS.recente })
    }
  }
  // O mês recente é criado a partir do anterior (copia a lista)
  const mNew = check(await supabase.rpc('start_month', { hid, p_month: MONTHS.recente }))
  check(await supabase.from('purchases').insert(purchases.map(({ _recent, ...p }) => (_recent ? { ...p, month_id: mNew } : p))))

  await loadCatalog(true)
  return { products: products.length, purchases: purchases.length }
}
