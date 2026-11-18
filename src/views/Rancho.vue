<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { catalog, storeName } from '../lib/catalog.js'
import { rancho, loadRancho, refreshAll, startMonth, setBudget, summary, boughtThisMonth, lastBefore, updateItem } from '../lib/rancho.js'
import { mt, monthLabel, norm } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'
import QuickPrice from '../components/QuickPrice.vue'
import AddToList from '../components/AddToList.vue'

const error = ref('')
const busy = ref(false)
const q = ref('')
const store = ref(localGet('rancho.store', ''))
const groupBy = ref(localGet('rancho.group', 'categoria'))
const hideDone = ref(localGet('rancho.hide', '0') === '1')
const openItem = ref(null)
const adding = ref(false)
const editingBudget = ref(false)
const budgetInput = ref('')

function localGet(k, d) { try { return localStorage.getItem(k) ?? d } catch { return d } }
function localSet(k, v) { try { localStorage.setItem(k, v) } catch { /* sem armazenamento */ } }

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}

// Quando o telemóvel volta à app, atualiza (a outra pessoa pode ter registado preços)
const onVisible = () => document.visibilityState === 'visible' && rancho.month && refreshAll().catch(() => {})
onMounted(() => { run(() => loadRancho()); document.addEventListener('visibilitychange', onVisible) })
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))

const product = (id) => catalog.products.find((p) => p.id === id)
const sum = computed(() => summary())

const rows = computed(() => {
  const t = norm(q.value)
  return rancho.items
    .map((it) => {
      const p = product(it.product_id)
      if (!p) return null
      const bought = boughtThisMonth(it.product_id)
      const ref0 = lastBefore(it.product_id)
      const paid = bought[0] ?? null
      const diff = paid && ref0 ? Number(paid.price) - Number(ref0.price) : null
      return { it, p, bought, paid, ref0, diff, isDone: it.done || bought.length > 0 }
    })
    .filter(Boolean)
    .filter((r) => !t || norm(r.p.name).includes(t))
    .filter((r) => !store.value || (r.it.store_id ?? '') === store.value)
    .filter((r) => !hideDone.value || !r.isDone)
    // Por comprar em cima, já no cesto em baixo; depois por nome
    .sort((a, b) => (a.isDone - b.isDone) || a.p.name.localeCompare(b.p.name, 'pt'))
})

const groups = computed(() => {
  const key = groupBy.value === 'loja' ? (r) => r.it.store_id ?? '' : (r) => r.p.category_id ?? ''
  const order = groupBy.value === 'loja'
    ? [...catalog.stores.map((s) => ({ id: s.id, name: s.name })), { id: '', name: 'Sem loja' }]
    : [...catalog.categories.map((c) => ({ id: c.id, name: c.name })), { id: '', name: 'Sem categoria' }]
  return order.map((g) => {
    const items = rows.value.filter((r) => key(r) === g.id)
    const subtotal = items.reduce((s, r) => s + (r.paid ? Number(r.paid.price) * Number(r.paid.quantity)
      : r.ref0 ? Number(r.ref0.price) * Number(r.it.planned_qty) : 0), 0)
    return { ...g, items, subtotal }
  }).filter((g) => g.items.length)
})

const storeCounts = computed(() => {
  const m = {}
  for (const it of rancho.items) if (!it.done && !boughtThisMonth(it.product_id).length) m[it.store_id ?? ''] = (m[it.store_id ?? ''] ?? 0) + 1
  return m
})

const budget = computed(() => rancho.month?.rancho_budget ?? null)
const pct = computed(() => (budget.value ? Math.min(100, Math.round((sum.value.spent / budget.value) * 100)) : 0))

function pickStore(id) { store.value = id; localSet('rancho.store', id) }
function setGroup(g) { groupBy.value = g; localSet('rancho.group', g) }
function toggleHide() { hideDone.value = !hideDone.value; localSet('rancho.hide', hideDone.value ? '1' : '0') }
function editBudget() { budgetInput.value = budget.value ?? ''; editingBudget.value = true }
const saveBudget = () => run(async () => { await setBudget(budgetInput.value); editingBudget.value = false })
// Marcar sem preço (ex.: produto que não se encontrou ou que já havia em casa)
const toggleDone = (r) => run(() => updateItem(r.it.id, { done: !r.it.done }))
</script>

<template>
  <section class="stack">
    <div class="title-row">
      <h1>Rancho <span class="muted month-name">{{ rancho.monthStart ? monthLabel(rancho.monthStart) : '' }}</span></h1>
      <button v-if="rancho.month" class="icon-btn" aria-label="Atualizar" :disabled="busy" @click="run(refreshAll)">🔄</button>
    </div>

    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="!rancho.loaded" class="muted">A carregar…</p>

    <!-- Mês ainda não aberto -->
    <div v-else-if="!rancho.month" class="card stack">
      <h2>Começar o rancho de {{ monthLabel(rancho.monthStart) }}</h2>
      <p class="muted">A lista do mês anterior é copiada, com as quantidades e as lojas. Depois podem tirar ou acrescentar produtos.</p>
      <button class="btn primary" :disabled="busy" @click="run(startMonth)">Começar o mês</button>
    </div>

    <template v-else>
      <!-- Resumo -->
      <div class="card summary">
        <div class="sum-grid">
          <div><div class="muted small">Estimativa</div><b>{{ mt(sum.estimate) }}</b></div>
          <div><div class="muted small">Gasto</div><b>{{ mt(sum.spent) }}</b></div>
          <div><div class="muted small">Hoje</div><b>{{ mt(sum.spentToday) }}</b></div>
        </div>
        <div v-if="budget" class="budget">
          <div class="bar" :class="{ over: sum.spent > budget }"><span :style="{ width: pct + '%' }"></span></div>
          <div class="small" :class="sum.spent > budget ? 'up-text' : 'muted'">
            <template v-if="sum.spent > budget">Passaram {{ mt(sum.spent - budget) }} do orçamento de {{ mt(budget) }}</template>
            <template v-else>Faltam {{ mt(budget - sum.spent) }} do orçamento de {{ mt(budget) }}</template>
            · <button class="link inline-link" @click="editBudget">mudar</button>
          </div>
          <div v-if="sum.estimate > budget" class="small up-text">⚠️ A estimativa passa o orçamento em {{ mt(sum.estimate - budget) }}</div>
        </div>
        <button v-else-if="!editingBudget" class="link" @click="editBudget">+ Definir orçamento do rancho</button>
        <form v-if="editingBudget" class="inline" @submit.prevent="saveBudget">
          <input v-model="budgetInput" inputmode="numeric" placeholder="Ex.: 20000" aria-label="Orçamento do rancho em meticais" />
          <button class="btn primary">OK</button>
        </form>
        <div class="muted small">{{ sum.done }} de {{ sum.count }} produtos no cesto<span v-if="sum.missingPrice"> · {{ sum.missingPrice }} sem preço anterior</span></div>
      </div>

      <!-- Filtros -->
      <div class="chips scroll" role="tablist" aria-label="Filtrar por loja">
        <button class="chip" :class="{ on: !store }" @click="pickStore('')">Todas</button>
        <button v-for="s in catalog.stores" :key="s.id" class="chip" :class="{ on: store === s.id }" @click="pickStore(s.id)">
          {{ s.name }}<span v-if="storeCounts[s.id]" class="count">{{ storeCounts[s.id] }}</span>
        </button>
      </div>
      <div class="toolbar">
        <input :value="q" @input="q = $event.target.value" type="search" placeholder="🔍 Procurar na lista" aria-label="Procurar na lista" />
        <div class="seg small-seg">
          <button :class="{ on: groupBy === 'categoria' }" @click="setGroup('categoria')">Categoria</button>
          <button :class="{ on: groupBy === 'loja' }" @click="setGroup('loja')">Loja</button>
        </div>
      </div>
      <div class="links">
        <button class="link" @click="toggleHide">{{ hideDone ? 'Mostrar os do cesto' : 'Esconder os do cesto' }}</button>
        <button class="link" @click="adding = true">+ Adicionar produto</button>
      </div>

      <p v-if="!rows.length" class="muted">Nada para mostrar com estes filtros.</p>

      <div v-for="g in groups" :key="g.id || 'none'" class="group">
        <h2 class="group-title">{{ g.name }} <span class="muted small">· {{ mt(g.subtotal) }}</span></h2>
        <ul class="plist">
          <li v-for="r in g.items" :key="r.it.id" class="lrow" :class="{ done: r.isDone }">
            <button class="check" :aria-label="r.isDone ? 'Tirar do cesto' : 'Pôr no cesto sem preço'"
                    :disabled="r.bought.length > 0" @click="toggleDone(r)">{{ r.isDone ? '✓' : '' }}</button>
            <button class="prow" @click="openItem = r.it">
              <span class="pname">{{ r.p.name }}<span v-if="Number(r.it.planned_qty) !== 1" class="muted"> × {{ Number(r.it.planned_qty) }}</span></span>
              <span class="pprice">
                <template v-if="r.paid">{{ mt(r.paid.price) }}</template>
                <template v-else>{{ mt(r.ref0?.price) }}</template>
              </span>
              <span class="pmeta muted small">
                <template v-if="r.paid">{{ storeName(r.paid.store_id) }}<template v-if="r.ref0"> · antes {{ mt(r.ref0.price) }}</template></template>
                <template v-else-if="r.ref0">{{ storeName(r.ref0.store_id) }} · {{ monthLabel(r.ref0.purchased_on) }}</template>
                <template v-else>Sem preço anterior</template>
              </span>
              <span v-if="r.diff != null" class="trend" :class="r.diff > 0.004 ? 'up' : r.diff < -0.004 ? 'down' : 'same'">
                {{ r.diff > 0.004 ? '▲ ' + mt(r.diff) : r.diff < -0.004 ? '▼ ' + mt(-r.diff) : '= igual' }}
              </span>
              <span v-else class="trend none">{{ r.paid ? 'novo' : '' }}</span>
            </button>
          </li>
        </ul>
      </div>
    </template>

    <QuickPrice v-if="openItem" :key="openItem.id" :item="openItem" :store-filter="store" @close="openItem = null" />
    <AddToList v-if="adding" :store-filter="store" @close="adding = false" @added="adding = false" />
  </section>
</template>
