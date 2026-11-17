<script setup>
import { ref, computed, onMounted } from 'vue'
import { catalog, loadCatalog, priceStats, storeName } from '../lib/catalog.js'
import { importInitialList } from '../lib/importar.js'
import { mt, monthLabel, norm } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'
import Trend from '../components/Trend.vue'
import ProductSheet from '../components/ProductSheet.vue'

const q = ref('')
const open = ref(null) // id do produto aberto, ou 'novo'
const error = ref('')
const importing = ref('')

onMounted(() => loadCatalog().catch((e) => (error.value = friendlyError(e))))

const rows = computed(() => {
  const term = norm(q.value)
  return catalog.products
    .filter((p) => !term || norm(p.name).includes(term))
    .map((p) => ({ ...p, stats: priceStats(p.id) }))
})

const groups = computed(() => {
  const order = [...catalog.categories, { id: null, name: 'Sem categoria' }]
  return order
    .map((c) => ({ ...c, items: rows.value.filter((p) => (p.category_id ?? null) === c.id) }))
    .filter((g) => g.items.length)
})

async function doImport() {
  error.value = ''
  try {
    const r = await importInitialList((step) => (importing.value = step))
    importing.value = `Importados ${r.products} produtos e ${r.purchases} preços.`
  } catch (e) {
    error.value = friendlyError(e); importing.value = ''
  }
}
</script>

<template>
  <section class="stack">
    <div class="title-row">
      <h1>Produtos</h1>
      <button class="btn primary small-btn" @click="open = 'novo'">+ Produto</button>
    </div>

    <input v-model="q" type="search" placeholder="🔍 Procurar produto…" aria-label="Procurar produto" class="search" />

    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="!catalog.loaded && catalog.loading" class="muted">A carregar…</p>

    <div v-else-if="catalog.loaded && !catalog.products.length" class="card stack">
      <h2>Ainda não há produtos</h2>
      <p class="muted">Podem importar a lista do vosso último rancho (107 produtos, 4 lojas e os preços que tinham nas notas) ou adicionar produtos um a um.</p>
      <button class="btn primary" :disabled="!!importing" @click="doImport">Importar a lista do rancho</button>
      <p v-if="importing" class="muted small">{{ importing }}</p>
    </div>

    <p v-else-if="q && !rows.length" class="muted">
      Nenhum produto com "{{ q }}". <button class="link" @click="open = 'novo'">Criar "{{ q }}"</button>
    </p>

    <p v-if="importing && catalog.products.length" class="msg ok">{{ importing }}</p>

    <div v-for="g in groups" :key="g.id ?? 'none'" class="group">
      <h2 class="group-title">{{ g.name }} <span class="muted small">({{ g.items.length }})</span></h2>
      <ul class="plist">
        <li v-for="p in g.items" :key="p.id">
          <button class="prow" @click="open = p.id">
            <span class="pname">{{ p.name }}</span>
            <span class="pprice">{{ mt(p.stats.last?.price) }}</span>
            <span class="pmeta muted small">
              <template v-if="p.stats.last">{{ storeName(p.stats.last.store_id) }} · {{ monthLabel(p.stats.last.purchased_on) }}</template>
              <template v-else>Sem preço</template>
            </span>
            <Trend :diff="p.stats.diff" />
          </button>
        </li>
      </ul>
    </div>

    <ProductSheet v-if="open" :key="open" :product-id="open === 'novo' ? null : open" :preset-name="open === 'novo' ? q : ''"
                  @close="open = null" @saved="(p) => (open = p.id)" />
  </section>
</template>
