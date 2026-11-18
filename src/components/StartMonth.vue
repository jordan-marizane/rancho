<script setup>
// Começar o mês: escolher os produtos a levar do mês anterior e a meta de poupança
import { ref, computed, onMounted } from 'vue'
import { catalog, loadCatalog } from '../lib/catalog.js'
import { rancho, startMonth, loadPrevPlan, lastBefore } from '../lib/rancho.js'
import { ranchoSpent } from '../lib/resumo.js'
import { mt, monthLabel } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'

const emit = defineEmits(['started'])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const prev = ref(null)
const items = ref([])
const keep = ref(new Set())
const goal = ref(0)
const customGoal = ref('')
const GOALS = [0, 500, 1000, 2000]

onMounted(async () => {
  try {
    await loadCatalog()
    const plan = await loadPrevPlan()
    prev.value = plan.prev
    items.value = plan.items.filter((i) => catalog.products.some((p) => p.id === i.product_id))
    keep.value = new Set(items.value.map((i) => i.product_id))
  } catch (e) { error.value = friendlyError(e) } finally { loading.value = false }
})

const product = (id) => catalog.products.find((p) => p.id === id)
const refPrice = (it) => { const r = lastBefore(it.product_id, rancho.monthStart); return r ? Number(r.price) * Number(it.planned_qty) : 0 }
const groups = computed(() => {
  const cats = [...catalog.categories, { id: null, name: 'Sem categoria' }]
  return cats.map((c) => ({
    ...c,
    items: items.value.filter((i) => (product(i.product_id)?.category_id ?? null) === c.id)
      .sort((a, b) => product(a.product_id).name.localeCompare(product(b.product_id).name, 'pt')),
  })).filter((g) => g.items.length)
})
const estimate = computed(() => items.value.filter((i) => keep.value.has(i.product_id)).reduce((s, i) => s + refPrice(i), 0))
const prevSpent = computed(() => (prev.value ? ranchoSpent(prev.value.id) : 0))
const goalValue = computed(() => (customGoal.value !== '' ? Number(String(customGoal.value).replace(/\s/g, '')) || 0 : goal.value))
const limit = computed(() => (prevSpent.value && goalValue.value ? Math.max(0, prevSpent.value - goalValue.value) : null))

function toggle(id) {
  const s = new Set(keep.value); s.has(id) ? s.delete(id) : s.add(id); keep.value = s
}
function toggleGroup(g) {
  const all = g.items.every((i) => keep.value.has(i.product_id))
  const s = new Set(keep.value)
  for (const i of g.items) all ? s.delete(i.product_id) : s.add(i.product_id)
  keep.value = s
}
const groupOn = (g) => g.items.filter((i) => keep.value.has(i.product_id)).length

async function start() {
  error.value = ''; busy.value = true
  try {
    const opts = { keep: items.value.length ? keep.value : null }
    if (goalValue.value > 0) { opts.goal = goalValue.value; if (limit.value != null) opts.budget = limit.value }
    await startMonth(opts)
    emit('started')
  } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
</script>

<template>
  <div class="card stack">
    <h2>Começar {{ monthLabel(rancho.monthStart) }}</h2>
    <p v-if="loading" class="muted">A carregar a lista de {{ prev ? monthLabel(prev.month) : 'o mês anterior' }}…</p>

    <template v-else>
      <template v-if="items.length">
        <p class="muted small" style="margin:0">Desmarquem o que não precisam este mês (por exemplo, o que ainda há em casa). As despesas fixas e o resto entram automaticamente.</p>

        <div class="start-sticky">
          <div><b>{{ keep.size }}</b> de {{ items.length }} produtos · estimativa <b>{{ mt(estimate) }}</b></div>
          <div v-if="limit != null" class="small" :class="estimate > limit ? 'up-text' : 'down-text'">
            {{ estimate > limit ? `Passa o limite da meta em ${mt(estimate - limit)}` : `Dentro do limite da meta (${mt(limit)})` }}
          </div>
        </div>

        <details v-for="g in groups" :key="g.id ?? 'none'" class="start-group">
          <summary>
            <span>{{ g.name }}</span>
            <span class="muted small">{{ groupOn(g) }}/{{ g.items.length }}</span>
            <button type="button" class="link small" @click.prevent="toggleGroup(g)">
              {{ g.items.every((i) => keep.has(i.product_id)) ? 'Desmarcar todos' : 'Marcar todos' }}</button>
          </summary>
          <label v-for="i in g.items" :key="i.id" class="checkline pick-line">
            <input type="checkbox" :checked="keep.has(i.product_id)" @change="toggle(i.product_id)" />
            <span class="grow">{{ product(i.product_id).name }}<span v-if="Number(i.planned_qty) !== 1" class="muted"> × {{ Number(i.planned_qty) }}</span></span>
            <span class="muted small">{{ refPrice(i) ? mt(refPrice(i)) : '' }}</span>
          </label>
        </details>
      </template>
      <p v-else class="muted small" style="margin:0">Ainda não há lista anterior: o mês começa vazio e podem adicionar produtos no Rancho.</p>

      <div v-if="prevSpent" class="stack goal-box">
        <h3>🎯 Meta de poupança no rancho</h3>
        <p class="muted small" style="margin:0">Em {{ monthLabel(prev.month) }} gastaram {{ mt(prevSpent) }}. Quanto querem poupar este mês?</p>
        <div class="chips">
          <button v-for="g in GOALS" :key="g" type="button" class="chip" :class="{ on: customGoal === '' && goal === g }"
                  @click="goal = g; customGoal = ''">{{ g ? mt(g) : 'Sem meta' }}</button>
        </div>
        <input v-model="customGoal" inputmode="numeric" placeholder="Outro valor (MT)" aria-label="Outro valor de meta" />
        <p v-if="limit != null" class="small" style="margin:0">Limite do rancho: <b>{{ mt(limit) }}</b></p>
      </div>

      <p v-if="error" class="msg error">{{ error }}</p>
      <button class="btn primary" :disabled="busy" @click="start">{{ busy ? 'A preparar…' : `Começar ${monthLabel(rancho.monthStart)}` }}</button>
    </template>
  </div>
</template>
