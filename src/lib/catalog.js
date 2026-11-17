import { reactive } from 'vue'
import { supabase } from './supabase.js'
import { session } from './session.js'

// Cache em memória do catálogo da família (lojas, categorias, produtos e preços)
export const catalog = reactive({
  loaded: false,
  loading: false,
  stores: [],
  categories: [],
  products: [],
  purchases: [],
})

function check({ data, error }) {
  if (error) throw error
  return data
}

export async function loadCatalog(force = false) {
  if (!session.household || (catalog.loaded && !force)) return
  catalog.loading = true
  try {
    const hid = session.household.id
    const [stores, categories, products, purchases] = await Promise.all([
      supabase.from('stores').select('*').eq('household_id', hid).order('name'),
      supabase.from('categories').select('*').eq('household_id', hid).order('sort_order').order('name'),
      supabase.from('products').select('*').eq('household_id', hid).eq('archived', false).order('name'),
      supabase.from('purchases').select('*').eq('household_id', hid)
        .order('purchased_on', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
    ])
    catalog.stores = check(stores)
    catalog.categories = check(categories)
    catalog.products = check(products)
    catalog.purchases = check(purchases)
    catalog.loaded = true
  } finally {
    catalog.loading = false
  }
}

export const storeName = (id) => catalog.stores.find((s) => s.id === id)?.name ?? 'Sem loja'
export const categoryName = (id) => catalog.categories.find((c) => c.id === id)?.name ?? 'Sem categoria'

const unitPrice = (p) => Number(p.price) / Number(p.pack_size || 1)

// Resumo de preços de um produto:
//  last      = compra mais recente
//  previous  = compra anterior noutra data (para dizer se subiu ou desceu)
//  cheapest  = preço unitário mais baixo nos últimos 6 meses, e em que loja
export function priceStats(productId) {
  const list = catalog.purchases.filter((p) => p.product_id === productId) // já vem ordenado, mais recente primeiro
  const last = list[0] ?? null
  const previous = last ? list.find((p) => p.purchased_on < last.purchased_on) ?? null : null
  let diff = null
  if (last && previous) diff = unitPrice(last) - unitPrice(previous)

  const since = new Date(); since.setMonth(since.getMonth() - 6)
  const sinceStr = since.toISOString().slice(0, 10)
  let cheapest = null
  for (const p of list) {
    if (p.purchased_on < sinceStr) continue
    if (!cheapest || unitPrice(p) < unitPrice(cheapest)) cheapest = p
  }
  return { last, previous, diff, cheapest, history: list }
}

// ---------- Escritas ----------
const hid = () => session.household.id

export async function addStore(name, kind = 'supermercado') {
  check(await supabase.from('stores').insert({ household_id: hid(), name: name.trim(), kind }))
  await loadCatalog(true)
}
export async function updateStore(id, fields) {
  check(await supabase.from('stores').update(fields).eq('id', id))
  await loadCatalog(true)
}
export async function addCategory(name) {
  const max = Math.max(0, ...catalog.categories.map((c) => c.sort_order))
  check(await supabase.from('categories').insert({ household_id: hid(), name: name.trim(), sort_order: max + 1 }))
  await loadCatalog(true)
}
export async function updateCategory(id, fields) {
  check(await supabase.from('categories').update(fields).eq('id', id))
  await loadCatalog(true)
}
export async function saveProduct(product) {
  const fields = {
    name: product.name.trim(),
    category_id: product.category_id || null,
    unit: product.unit || 'un',
    pack_size: product.pack_size || 1,
  }
  const res = product.id
    ? await supabase.from('products').update(fields).eq('id', product.id).select().single()
    : await supabase.from('products').insert({ household_id: hid(), ...fields }).select().single()
  const saved = check(res)
  await loadCatalog(true)
  return saved
}
export async function archiveProduct(id) {
  check(await supabase.from('products').update({ archived: true }).eq('id', id))
  await loadCatalog(true)
}
export async function addPurchase({ product_id, store_id, price, quantity = 1, purchased_on }) {
  const product = catalog.products.find((p) => p.id === product_id)
  check(await supabase.from('purchases').insert({
    household_id: hid(), product_id, store_id: store_id || null,
    price, quantity, pack_size: product?.pack_size || 1, purchased_on,
  }))
  await loadCatalog(true)
}
export async function deletePurchase(id) {
  check(await supabase.from('purchases').delete().eq('id', id))
  await loadCatalog(true)
}
