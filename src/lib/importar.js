import { supabase } from './supabase.js'
import { session } from './session.js'
import { loadCatalog } from './catalog.js'
import { STORES, CATEGORIES, MONTH, PURCHASE_DATE } from '../data/lista-inicial.js'

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
  const rows = CATEGORIES.flatMap((c) => c.items.map(([name, , o = {}]) => ({
    household_id: hid, name, category_id: catId(c.name), unit: o.unit ?? 'un', default_qty: o.qty ?? 1,
  })))
  const products = check(await supabase.from('products').insert(rows).select('id, name'))
  const prodId = (name) => products.find((p) => p.name === name).id

  onProgress('Mês de outubro e lista do rancho…')
  const mid = check(await supabase.rpc('start_month', { hid, p_month: MONTH }))
  check(await supabase.from('list_items').insert(CATEGORIES.flatMap((c) => c.items.map(([name, price, o = {}]) => ({
    household_id: hid, month_id: mid, product_id: prodId(name),
    planned_qty: o.qty ?? 1, store_id: storeId(o.store ?? c.store), done: price != null,
  })))))

  onProgress('Preços…')
  const purchases = []
  for (const c of CATEGORIES) {
    for (const [name, price, o = {}] of c.items) {
      const base = { household_id: hid, product_id: prodId(name), quantity: o.qty ?? 1, purchased_on: PURCHASE_DATE }
      if (price != null) purchases.push({ ...base, store_id: storeId(o.store ?? c.store), price, month_id: mid })
      // Preço visto noutra loja: entra no histórico, mas não conta como gasto do mês
      if (o.alt) purchases.push({ ...base, store_id: storeId(o.alt[0]), price: o.alt[1] })
    }
  }
  check(await supabase.from('purchases').insert(purchases))

  await loadCatalog(true)
  return { products: products.length, purchases: purchases.length }
}
