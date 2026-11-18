<script setup>
import { ref, computed, onMounted } from 'vue'
import StartMonth from '../components/StartMonth.vue'
import InstallButton from '../components/InstallButton.vue'
import { rancho, loadRancho, summary, setReserve, setBudget, setGoal } from '../lib/rancho.js'
import { despesas, loadDespesas, fixedSummary, extraSummary } from '../lib/despesas.js'
import { monthBudget } from '../lib/resumo.js'
import { session } from '../lib/session.js'
import { mt, monthLabel } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'
import { loadMonths, ranchoSpent } from '../lib/resumo.js'
import { savingTips } from '../lib/dicas.js'

const prevMonth = ref(null)
const dismissed = ref(false)
const dismissKey = () => `rancho.sugestao.${rancho.month?.id}`
async function loadPrev() {
  const all = await loadMonths()
  prevMonth.value = [...all].reverse().find((m) => m.month < rancho.monthStart) ?? null
  try { dismissed.value = localStorage.getItem(dismissKey()) === '1' } catch { /* sem armazenamento */ }
}
const prevSpent = computed(() => (prevMonth.value ? ranchoSpent(prevMonth.value.id) : 0))
// Mostrar no início do mês: ainda sem compras e o limite ainda não foi revisto
const goalChoices = [500, 1000, 2000]
const customGoal = ref('')
const goal = computed(() => (rancho.month?.savings_goal != null ? Number(rancho.month.savings_goal) : null))
const showGoalSetup = computed(() => rancho.month && goal.value == null && prevSpent.value > 0 && !dismissed.value)
function dismiss() { dismissed.value = true; try { localStorage.setItem(dismissKey(), '1') } catch { /* */ } }
const chooseGoal = (g) => run(async () => {
  const v = Number(String(g).replace(/\s/g, ''))
  if (!v) return
  await setGoal(v, Math.max(0, prevSpent.value - v))
  customGoal.value = ''
})
// Quanto pouparão se comprarem a lista como está (face ao mês anterior)
const projectedSaving = computed(() => prevSpent.value - r.value.estimate)
const tips = computed(() => (rancho.month ? savingTips(prevMonth.value?.id) : []))
const showTips = ref(false)

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
const x = computed(() => extraSummary())
// Orçamento = fixas + limite do rancho + reserva para imprevistos.
// Previsto = fixas + estimativa do rancho + imprevistos (a reserva, ou o já gasto se passou).
// Gasto = fixas pagas + rancho gasto + outras despesas.
const budget = computed(() => (rancho.month ? monthBudget(rancho.month, f.value.total) : null))
const planned = computed(() => f.value.total + r.value.estimate + Math.max(x.value.reserve ?? 0, x.value.total))
const spent = computed(() => f.value.paid + r.value.spent + x.value.total)
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0)

function openEdit() {
  totalInput.value = rancho.month?.reserve_budget ?? ''
  ranchoInput.value = rancho.month?.rancho_budget ?? ''
  editing.value = true
}
const num = (v) => (String(v).trim() === '' ? '' : Number(String(v).replace(/\s/g, '').replace(',', '.')))
const saveBudgets = () => run(async () => {
  await setBudget(num(ranchoInput.value))
  await setReserve(num(totalInput.value))
  editing.value = false
})
const begin = () => run(async () => { await loadDespesas(); await loadPrev() })
</script>

<template>
  <section class="stack">
    <h1>Olá, {{ session.member?.display_name }} <span class="muted month-name">· {{ rancho.monthStart ? monthLabel(rancho.monthStart) : '' }}</span></h1>
    <InstallButton />
    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="!rancho.loaded" class="muted">A carregar…</p>

    <StartMonth v-else-if="!rancho.month" @started="begin" />

    <template v-else>
      <!-- Meta de poupança -->
      <div v-if="goal" class="card stack suggest">
        <div class="title-row"><h2>🎯 Meta: poupar {{ mt(goal) }}</h2></div>
        <p class="small muted" style="margin:0">Face a {{ prevMonth ? monthLabel(prevMonth.month) : 'o mês anterior' }} ({{ mt(prevSpent) }}) · limite do rancho {{ mt(rancho.month.rancho_budget) }}</p>
        <p class="verdict" :class="projectedSaving >= goal ? 'good' : 'bad'">
          <template v-if="projectedSaving >= goal">Com a lista atual pouparão cerca de {{ mt(projectedSaving) }} ✔</template>
          <template v-else>Com a lista atual faltam cerca de {{ mt(goal - projectedSaving) }} para a meta</template>
        </p>
      </div>
      <div v-else-if="showGoalSetup" class="card stack suggest">
        <h2>🎯 Meta de poupança</h2>
        <p style="margin:0">Em {{ monthLabel(prevMonth.month) }} gastaram <b>{{ mt(prevSpent) }}</b> no rancho. Quanto querem poupar em {{ monthLabel(rancho.monthStart) }}?</p>
        <div class="chips">
          <button v-for="g in goalChoices" :key="g" class="chip" :disabled="busy" @click="chooseGoal(g)">{{ mt(g) }}</button>
        </div>
        <form class="inline" @submit.prevent="chooseGoal(customGoal)">
          <input v-model="customGoal" inputmode="numeric" placeholder="Outro valor (MT)" aria-label="Outro valor de meta" />
          <button class="btn primary" :disabled="busy || !customGoal">OK</button>
        </form>
        <button class="link" @click="dismiss">Agora não</button>
      </div>

      <!-- Onde poupar -->
      <div v-if="tips.length" class="card stack">
        <h2>💡 Onde podem poupar</h2>
        <ul class="plain tips">
          <li v-for="t in (showTips ? tips : tips.slice(0, 3))" :key="t.text"><span>{{ t.icon }}</span><span>{{ t.text }}</span></li>
        </ul>
        <button v-if="tips.length > 3" class="link" @click="showTips = !showTips">{{ showTips ? 'Mostrar menos' : `Ver as ${tips.length} sugestões` }}</button>
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

        <p v-if="budget != null && rancho.month.rancho_budget != null" class="muted small" style="margin:0">
          = fixas {{ mt(f.total) }} + rancho {{ mt(rancho.month.rancho_budget) }} + reserva {{ mt(rancho.month.reserve_budget ?? 0) }}</p>

        <form v-if="editing" class="stack" @submit.prevent="saveBudgets">
          <div class="row2">
            <label>Limite do rancho (MT) <input v-model="ranchoInput" inputmode="numeric" placeholder="Ex.: 22000" /></label>
            <label>Reserva p/ imprevistos (MT) <input v-model="totalInput" inputmode="numeric" placeholder="Ex.: 3000" /></label>
          </div>
          <p class="muted small" style="margin:0">O orçamento do mês é a soma das despesas fixas, do limite do rancho e da reserva. Passam para o mês seguinte automaticamente.</p>
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

      <!-- Outras despesas -->
      <RouterLink :to="{ path: '/despesas', query: { tab: 'outras' } }" class="card stack card-link">
        <div class="title-row"><h2>📌 Outras despesas</h2><span class="muted">›</span></div>
        <template v-if="x.reserve != null">
          <div class="bar" :class="{ over: x.total > x.reserve }"><span :style="{ width: pct(x.total, x.reserve) + '%' }"></span></div>
          <div class="small">{{ mt(x.total) }} de {{ mt(x.reserve) }} da reserva ·
            <b :class="{ 'up-text': x.left < 0 }">{{ x.left < 0 ? `passou ${mt(-x.left)}` : `sobram ${mt(x.left)}` }}</b></div>
        </template>
        <div v-else class="small">{{ x.count ? `${x.count} lançadas · ${mt(x.total)}` : 'Recargas Credelec, farmácia, reparações… Toca para lançar.' }}</div>
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
