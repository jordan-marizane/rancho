<script setup>
import { ref, computed, onMounted } from 'vue'
import { rancho, loadRancho, startMonth, summary, setTotalBudget, setBudget } from '../lib/rancho.js'
import { despesas, loadDespesas, fixedSummary } from '../lib/despesas.js'
import { session } from '../lib/session.js'
import { mt, monthLabel } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'
import { loadMonths, ranchoSpent, suggestRanchoBudget } from '../lib/resumo.js'

const prevMonth = ref(null)
const dismissed = ref(false)
const dismissKey = () => `rancho.sugestao.${rancho.month?.id}`
async function loadPrev() {
  const all = await loadMonths()
  prevMonth.value = [...all].reverse().find((m) => m.month < rancho.monthStart) ?? null
  try { dismissed.value = localStorage.getItem(dismissKey()) === '1' } catch { /* sem armazenamento */ }
}
const prevSpent = computed(() => (prevMonth.value ? ranchoSpent(prevMonth.value.id) : 0))
const suggestion = computed(() => suggestRanchoBudget(prevSpent.value))
// Mostrar no início do mês: ainda sem compras e o limite ainda não foi revisto
const showSuggestion = computed(() => rancho.month && suggestion.value && !dismissed.value && r.value.spent === 0
  && Number(rancho.month.rancho_budget) !== suggestion.value)
function dismiss() { dismissed.value = true; try { localStorage.setItem(dismissKey(), '1') } catch { /* */ } }
const acceptSuggestion = () => run(async () => { await setBudget(suggestion.value); dismiss() })

const error = ref('')
const busy = ref(false)
const editing = ref(false)
const totalInput = ref('')
const ranchoInput = ref('')

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
onMounted(() => run(async () => { await loadRancho(); await loadDespesas(); await loadPrev() }))

const r = computed(() => summary())
const f = computed(() => fixedSummary())
// Previsto = despesas fixas + estimativa do rancho. Gasto = fixas pagas + rancho gasto.
const planned = computed(() => f.value.total + r.value.estimate)
const spent = computed(() => f.value.paid + r.value.spent)
const budget = computed(() => rancho.month?.total_budget ?? null)
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0)

function openEdit() {
  totalInput.value = budget.value ?? ''
  ranchoInput.value = rancho.month?.rancho_budget ?? ''
  editing.value = true
}
const num = (v) => (String(v).trim() === '' ? '' : Number(String(v).replace(/\s/g, '').replace(',', '.')))
const saveBudgets = () => run(async () => {
  await setTotalBudget(num(totalInput.value))
  await setBudget(num(ranchoInput.value))
  editing.value = false
})
const begin = () => run(async () => { await startMonth(); await loadDespesas(); await loadPrev() })
</script>

<template>
  <section class="stack">
    <h1>Olá, {{ session.member?.display_name }} <span class="muted month-name">· {{ rancho.monthStart ? monthLabel(rancho.monthStart) : '' }}</span></h1>
    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="!rancho.loaded" class="muted">A carregar…</p>

    <div v-else-if="!rancho.month" class="card stack">
      <h2>Começar {{ monthLabel(rancho.monthStart) }}</h2>
      <p class="muted">Copia a lista do rancho, as despesas fixas e os orçamentos do mês anterior.</p>
      <button class="btn primary" :disabled="busy" @click="begin">Começar o mês</button>
    </div>

    <template v-else>
      <!-- Sugestão de orçamento do rancho -->
      <div v-if="showSuggestion" class="card stack suggest">
        <h2>💡 Orçamento do rancho</h2>
        <p style="margin:0">Em {{ monthLabel(prevMonth.month) }} gastaram <b>{{ mt(prevSpent) }}</b> no rancho.
          Sugestão para {{ monthLabel(rancho.monthStart) }}: <b>{{ mt(suggestion) }}</b> (5% menos).</p>
        <p v-if="rancho.month.rancho_budget" class="muted small" style="margin:0">Limite atual: {{ mt(rancho.month.rancho_budget) }}</p>
        <div class="inline">
          <button class="btn primary" :disabled="busy" @click="acceptSuggestion">Aceitar {{ mt(suggestion) }}</button>
          <button class="btn" @click="dismiss(); openEdit()">Definir outro</button>
        </div>
      </div>

      <!-- Orçamento do mês -->
      <div class="card stack">
        <div class="title-row"><h2>Orçamento do mês</h2><button class="link" @click="openEdit">{{ budget ? 'mudar' : 'definir' }}</button></div>
        <div class="sum-grid">
          <div><div class="muted small">Orçamento</div><b>{{ mt(budget) }}</b></div>
          <div><div class="muted small">Previsto</div><b :class="{ 'up-text': budget && planned > budget }">{{ mt(planned) }}</b></div>
          <div><div class="muted small">Gasto</div><b>{{ mt(spent) }}</b></div>
        </div>
        <template v-if="budget">
          <div class="bar" :class="{ over: spent > budget }"><span :style="{ width: pct(spent, budget) + '%' }"></span></div>
          <p v-if="planned > budget" class="small up-text" style="margin:0">⚠️ O previsto passa o orçamento em {{ mt(planned - budget) }}</p>
          <p v-else class="small muted" style="margin:0">Se tudo correr como previsto, sobram {{ mt(budget - planned) }}</p>
        </template>
        <p v-else class="muted small" style="margin:0">Definam um orçamento para saber se ficam dentro.</p>

        <form v-if="editing" class="stack" @submit.prevent="saveBudgets">
          <div class="row2">
            <label>Total do mês (MT) <input v-model="totalInput" inputmode="numeric" placeholder="Ex.: 80000" /></label>
            <label>Só o rancho (MT) <input v-model="ranchoInput" inputmode="numeric" placeholder="Ex.: 20000" /></label>
          </div>
          <p class="muted small" style="margin:0">Os orçamentos passam para o mês seguinte automaticamente.</p>
          <button class="btn primary" :disabled="busy">Guardar</button>
        </form>
      </div>

      <!-- Despesas fixas -->
      <RouterLink to="/despesas" class="card stack card-link">
        <div class="title-row"><h2>📅 Despesas fixas</h2><span class="muted">›</span></div>
        <template v-if="f.count">
          <div class="bar"><span :style="{ width: pct(f.paid, f.total) + '%' }"></span></div>
          <div class="small">{{ f.paidCount }} de {{ f.count }} pagas · faltam <b>{{ mt(f.unpaid) }}</b></div>
          <div v-if="f.late.length" class="small up-text">Em atraso: {{ f.late.map((i) => i.name).join(', ') }}</div>
          <div v-else-if="f.next.length" class="small muted">Próximas: {{ f.next.map((i) => i.name + (i.due_day ? ` (dia ${i.due_day})` : '')).join(', ') }}</div>
        </template>
        <div v-else class="small muted">Ainda sem despesas fixas. Toca para adicionar.</div>
      </RouterLink>

      <!-- Rancho -->
      <RouterLink to="/rancho" class="card stack card-link">
        <div class="title-row"><h2>🛒 Rancho</h2><span class="muted">›</span></div>
        <div class="sum-grid">
          <div><div class="muted small">Estimativa</div><b>{{ mt(r.estimate) }}</b></div>
          <div><div class="muted small">Gasto</div><b>{{ mt(r.spent) }}</b></div>
          <div><div class="muted small">Orçamento</div><b>{{ mt(rancho.month.rancho_budget) }}</b></div>
        </div>
        <template v-if="rancho.month.rancho_budget">
          <div class="bar" :class="{ over: r.spent > rancho.month.rancho_budget }"><span :style="{ width: pct(r.spent, rancho.month.rancho_budget) + '%' }"></span></div>
        </template>
        <div class="small muted">{{ r.done }} de {{ r.count }} produtos no cesto</div>
      </RouterLink>
    </template>
  </section>
</template>
