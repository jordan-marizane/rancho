<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { catalog, storeName } from '../lib/catalog.js'
import { rancho, loadRancho, refreshAll, startMonth, setBudget, summary, boughtThisMonth, lastBefore, expectedPrice, updateItem, activeItems } from '../lib/rancho.js'
import { mt, monthLabel, norm, qtyLabel, perUnit } from '../lib/format.js'
import { memberName } from '../lib/session.js'
import { friendlyError } from '../lib/errors.js'
import QuickPrice from '../components/QuickPrice.vue'
import AddToList from '../components/AddToList.vue'
import StartMonth from '../components/StartMonth.vue'

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
      const exp = expectedPrice(it)
      // Antes de comprar: diferença entre o previsto e o último preço
      const planDiff = !paid && it.planned_price != null && ref0 ? Number(it.planned_price) - Number(ref0.price) : null
      // Quantidade, preço unitário e subtotal (o que foi pago, ou o previsto)
      const qty = paid ? bought.reduce((n, b) => n + Number(b.quantity), 0) : Number(it.planned_qty)
      const unit = paid ? Number(paid.price) : exp
      const sub = paid ? bought.reduce((n, b) => n + Number(b.price) * Number(b.quantity), 0) : exp != null ? exp * qty : null
      return { it, p, bought, paid, ref0, diff, exp, planDiff, qty, unit, sub, isDone: it.done || bought.length > 0 }
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
    const subtotal = items.reduce((s, r) => s + (r.sub ?? 0), 0)
    return { ...g, items, subtotal }
  }).filter((g) => g.items.length)
})

const storeCounts = computed(() => {
  const m = {}
  for (const it of activeItems()) if (!it.done && !boughtThisMonth(it.product_id).length) m[it.store_id ?? ''] = (m[it.store_id ?? ''] ?? 0) + 1
  return m
})

const budget = computed(() => rancho.month?.rancho_budget ?? null)
const pct = computed(() => (budget.value ? Math.min(100, Math.round((sum.value.spent / budget.value) * 100)) : 0))

// Grupos abertos (guardado neste telemóvel). Começam recolhidos; ao pesquisar abrem todos.
const openGroups = ref(new Set((() => { try { return JSON.parse(localGet('rancho.abertas', '[]')) } catch { return [] } })()))
const gkey = (g) => `${groupBy.value}:${g.id || 'none'}`
const isOpen = (g) => !!q.value.trim() || openGroups.value.has(gkey(g))
function saveOpen() { localSet('rancho.abertas', JSON.stringify([...openGroups.value])) }
function toggleGroup(g) {
  const s = new Set(openGroups.value); s.has(gkey(g)) ? s.delete(gkey(g)) : s.add(gkey(g))
  openGroups.value = s; saveOpen()
}
const allOpen = computed(() => groups.value.length > 0 && groups.value.every((g) => openGroups.value.has(gkey(g))))
function toggleAll() {
  const s = new Set([...openGroups.value].filter((k) => !k.startsWith(groupBy.value + ':')))
  if (!allOpen.value) groups.value.forEach((g) => s.add(gkey(g)))
  openGroups.value = s; saveOpen()
}

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
    <StartMonth v-else-if="!rancho.month" />

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

      <!-- Filtros (ficam fixos no topo ao rolar a lista) -->
      <div class="sticky-tools">
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
      </div>
      <div class="links">
        <button class="link" @click="toggleHide">{{ hideDone ? 'Mostrar os do cesto' : 'Esconder os do cesto' }}</button>
        <button v-if="groups.length > 1 && !q.trim()" class="link" @click="toggleAll">{{ allOpen ? 'Recolher todas' : 'Abrir todas' }}</button>
      </div>

      <p v-if="!rows.length" class="muted">Nada para mostrar com estes filtros.</p>

      <div v-for="g in groups" :key="g.id || 'none'" class="group">
        <h2 class="group-title">
          <button class="group-toggle" :aria-expanded="isOpen(g)" @click="toggleGroup(g)">
            <span class="caret" aria-hidden="true">{{ isOpen(g) ? '▾' : '▸' }}</span>
            <span class="grow">{{ g.name }}</span>
            <span class="muted small">{{ g.items.filter((r) => r.isDone).length }}/{{ g.items.length }} · {{ mt(g.subtotal) }}</span>
          </button>
        </h2>
        <ul v-if="isOpen(g)" class="plist">
          <li v-for="r in g.items" :key="r.it.id" class="lrow" :class="{ done: r.isDone }">
            <button class="check" :aria-label="r.isDone ? 'Tirar do cesto' : 'Pôr no cesto sem preço'"
                    :disabled="r.bought.length > 0" @click="toggleDone(r)">{{ r.isDone ? '✓' : '' }}</button>
            <button class="prow" @click="openItem = r.it">
              <span class="pname">{{ r.p.name }}<span v-if="r.qty !== 1 || r.p.unit === 'kg' || r.p.unit === 'L'" class="muted small"> · {{ qtyLabel(r.qty, r.p.unit) }} × {{ mt(r.unit) }}{{ perUnit(r.p.unit) }}</span></span>
              <span class="pprice">{{ mt(r.sub) }}</span>
              <span class="pmeta muted small">
                <template v-if="r.paid">{{ storeName(r.paid.store_id) }} · {{ memberName(r.paid.created_by) }}<template v-if="r.ref0"> · antes {{ mt(r.ref0.price) }}</template></template>
                <template v-else-if="r.it.done">✓ no cesto, sem preço · {{ memberName(r.it.updated_by) }}</template>
                <template v-else-if="r.it.planned_price != null">📝 previsto<template v-if="r.ref0"> · antes {{ mt(r.ref0.price) }}</template></template>
                <template v-else-if="r.ref0">{{ storeName(r.ref0.store_id) }} · {{ monthLabel(r.ref0.purchased_on) }}</template>
                <template v-else>Sem preço anterior</template>
              </span>
              <span v-if="(r.diff ?? r.planDiff) != null" class="trend" :class="(r.diff ?? r.planDiff) > 0.004 ? 'up' : (r.diff ?? r.planDiff) < -0.004 ? 'down' : 'same'">
                {{ (r.diff ?? r.planDiff) > 0.004 ? '▲ ' + mt(r.diff ?? r.planDiff) : (r.diff ?? r.planDiff) < -0.004 ? '▼ ' + mt(-(r.diff ?? r.planDiff)) : '= igual' }}
              </span>
              <span v-else class="trend none">{{ r.paid ? 'novo' : '' }}</span>
            </button>
          </li>
        </ul>
      </div>
    </template>

    <QuickPrice v-if="openItem" :key="openItem.id" :item="openItem" :store-filter="store" @close="openItem = null" />
    <AddToList v-if="adding" :store-filter="store" @close="adding = false" @added="(it) => { adding = false; if (it) openItem = it }" />
    <div v-if="rancho.month" style="height:64px" aria-hidden="true"></div>
    <button v-if="rancho.month && !adding && !openItem" class="fab" aria-label="Adicionar produto à lista" @click="adding = true">＋</button>
  </section>
</template>
