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

// A compra foi registada na unidade atual do produto? (preço por kg não se compara com preço por unidade)
// Compras antigas sem unidade contam como a unidade atual: ao mudar a unidade, as antigas ficam marcadas.
export function sameUnit(p) {
  if (!p.unit) return true
  const prod = catalog.products.find((x) => x.id === p.product_id)
  return !prod || p.unit === prod.unit
}

// Resumo de preços de um produto:
//  last      = compra mais recente
//  previous  = compra anterior noutra data (para dizer se subiu ou desceu)
//  cheapest  = preço unitário mais baixo nos últimos 6 meses, e em que loja
export function priceStats(productId) {
  const history = catalog.purchases.filter((p) => p.product_id === productId) // já vem ordenado, mais recente primeiro
  const list = history.filter(sameUnit)
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
  return { last, previous, diff, cheapest, history }
}

// ---------- Escritas ----------
// Enquanto a migração 008 não estiver aplicada, a coluna "unit" das compras não existe:
// tenta com a unidade e, se a coluna faltar, grava sem ela.
const missingUnit = (e) => /'unit' column|column "unit"|purchases\.unit/i.test(e?.message ?? '')
export async function insertPurchase(row) {
  let res = await supabase.from('purchases').insert(row).select().single()
  if (res.error && missingUnit(res.error)) { const { unit, ...rest } = row; res = await supabase.from('purchases').insert(rest).select().single() }
  return check(res)
}
async function stampOldUnit(productId, unit) {
  const { error } = await supabase.from('purchases').update({ unit }).eq('product_id', productId).is('unit', null)
  if (error && !missingUnit(error)) throw error
}
const hid = () => session.household.id

export async function addStore(name, kind = 'supermercado') {
  const row = check(await supabase.from('stores').insert({ household_id: hid(), name: name.trim(), kind }).select().single())
  await loadCatalog(true)
  return row
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
  let id = product.id
  // Mudar a unidade de um produto existente: as compras antigas ficam marcadas com a unidade antiga
  const before = id ? catalog.products.find((x) => x.id === id) : null
  if (before && before.unit !== fields.unit) {
    await stampOldUnit(id, before.unit)
  }
  if (!id) {
    // "Remover produto" só esconde o produto (para guardar o histórico de preços).
    // Criar outra vez um produto com o mesmo nome recupera esse produto e o seu histórico.
    const key = fields.name.toLowerCase()
    const { data: hidden } = await supabase.from('products').select('id, name').eq('household_id', hid()).eq('archived', true)
    id = (hidden ?? []).find((p) => p.name.trim().toLowerCase() === key)?.id
    if (id) {
      fields.archived = false
      if (!product.category_id) delete fields.category_id // mantém a categoria que tinha
    }
  }
  const res = id
    ? await supabase.from('products').update(fields).eq('id', id).select().single()
    : await supabase.from('products').insert({ household_id: hid(), ...fields }).select().single()
  const saved = check(res)
  await loadCatalog(true)
  return saved
}
// Muda só a unidade do produto (escolhida ao comprar: Qtd, Kg ou Litro)
export async function setProductUnit(id, unit) {
  const p = catalog.products.find((x) => x.id === id)
  // As compras antigas ficam marcadas com a unidade antiga, para não se compararem com a nova
  await stampOldUnit(id, p?.unit ?? 'un')
  for (const x of catalog.purchases) if (x.product_id === id && !x.unit) x.unit = p?.unit ?? 'un'
  check(await supabase.from('products').update({ unit }).eq('id', id))
  if (p) p.unit = unit
}

export async function archiveProduct(id) {
  check(await supabase.from('products').update({ archived: true }).eq('id', id))
  await loadCatalog(true)
}
export async function addPurchase({ product_id, store_id, price, quantity = 1, purchased_on }) {
  const product = catalog.products.find((p) => p.id === product_id)
  await insertPurchase({
    household_id: hid(), product_id, store_id: store_id || null,
    price, quantity, pack_size: product?.pack_size || 1, purchased_on, unit: product?.unit ?? 'un',
  })
  await loadCatalog(true)
}
export async function deletePurchase(id) {
  check(await supabase.from('purchases').delete().eq('id', id))
  await loadCatalog(true)
}
