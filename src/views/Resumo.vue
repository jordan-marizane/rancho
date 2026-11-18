<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { loadCatalog } from '../lib/catalog.js'
import { loadMonths, loadMonthExpenses, monthSummary, achievements } from '../lib/resumo.js'
import { currentMonthStart } from '../lib/rancho.js'
import { mt, monthLabel } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'

const months = ref([])
const idx = ref(-1)
const expenses = ref([])
const expensesFor = ref(null) // id do mês a que as despesas carregadas pertencem
const error = ref('')
const loading = ref(true)
const showAll = ref(false)

onMounted(async () => {
  try {
    await loadCatalog()
    months.value = await loadMonths()
    const cur = months.value.findIndex((m) => m.month === currentMonthStart())
    idx.value = cur >= 0 ? cur : months.value.length - 1
  } catch (e) { error.value = friendlyError(e) } finally { loading.value = false }
})
const month = computed(() => months.value[idx.value] ?? null)
const prev = computed(() => (idx.value > 0 ? months.value[idx.value - 1] : null))
watch(month, async (m) => {
  showAll.value = false
  if (!m) return
  try { expenses.value = await loadMonthExpenses(m.id) } catch (e) { error.value = friendlyError(e); expenses.value = [] }
  expensesFor.value = m.id
})

// Só mostra o resumo quando as despesas desse mês já chegaram (evita números incompletos)
const s = computed(() => (month.value && expensesFor.value === month.value.id ? monthSummary(month.value, prev.value, expenses.value) : null))
const trophies = computed(() => achievements(months.value))
const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`
</script>

<template>
  <section class="stack">
    <div class="title-row">
      <button class="icon-btn" aria-label="Mês anterior" :disabled="idx <= 0" @click="idx--">‹</button>
      <h1 class="center grow">Resumo <span class="muted month-name">{{ month ? monthLabel(month.month) : '' }}</span></h1>
      <button class="icon-btn" aria-label="Mês seguinte" :disabled="idx >= months.length - 1" @click="idx++">›</button>
    </div>
    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="loading" class="muted">A carregar…</p>
    <p v-else-if="!month" class="muted">Ainda não há meses para resumir.</p>

    <template v-else-if="s">
      <!-- Orçamento total -->
      <div class="card stack">
        <h2>Mês inteiro</h2>
        <div class="sum-grid">
          <div><div class="muted small">Orçamento</div><b>{{ mt(s.budgetTotal) }}</b></div>
          <div><div class="muted small">Gasto</div><b>{{ mt(s.spentTotal) }}</b></div>
          <div><div class="muted small">Diferença</div>
            <b v-if="s.budgetTotal != null" :class="s.spentTotal > s.budgetTotal ? 'up-text' : 'down-text'">
              {{ s.spentTotal > s.budgetTotal ? '+' : '−' }}{{ mt(Math.abs(s.budgetTotal - s.spentTotal)) }}</b>
            <b v-else>—</b></div>
        </div>
        <p v-if="s.budgetTotal != null" class="verdict" :class="s.spentTotal > s.budgetTotal ? 'bad' : 'good'">
          {{ s.spentTotal > s.budgetTotal ? `Saíram do orçamento em ${mt(s.spentTotal - s.budgetTotal)}` : `Ficaram dentro do orçamento: sobraram ${mt(s.budgetTotal - s.spentTotal)}` }}
        </p>
        <p class="muted small" style="margin:0">Despesas fixas pagas {{ mt(s.fixedPaid) }} de {{ mt(s.fixedTotal) }} · rancho {{ mt(s.spentRancho) }}</p>
        <p v-if="s.unpaid.length" class="small up-text" style="margin:0">Por pagar: {{ s.unpaid.map((e) => e.name).join(', ') }}</p>
      </div>

      <!-- Rancho -->
      <div class="card stack">
        <h2>🛒 Rancho</h2>
        <div class="sum-grid">
          <div><div class="muted small">Orçamento</div><b>{{ mt(s.budgetRancho) }}</b></div>
          <div><div class="muted small">Gasto</div><b>{{ mt(s.spentRancho) }}</b></div>
          <div><div class="muted small">{{ prev ? monthLabel(prev.month) : 'Mês anterior' }}</div><b>{{ mt(s.prevRancho) }}</b></div>
        </div>
        <p v-if="s.budgetRancho != null" class="verdict" :class="s.spentRancho > s.budgetRancho ? 'bad' : 'good'">
          {{ s.spentRancho > s.budgetRancho ? `Rancho acima do limite em ${mt(s.spentRancho - s.budgetRancho)}` : `Rancho dentro do limite: conseguiram conter ${mt(s.budgetRancho - s.spentRancho)}` }}
        </p>
        <p v-if="s.prevRancho" class="small" style="margin:0">
          Face a {{ monthLabel(prev.month) }}:
          <b :class="s.spentRancho > s.prevRancho ? 'up-text' : 'down-text'">
            {{ s.spentRancho > s.prevRancho ? 'mais' : 'menos' }} {{ mt(Math.abs(s.spentRancho - s.prevRancho)) }}</b>
        </p>
        <p v-if="s.up.length || s.down.length" class="small" style="margin:0">
          Efeito dos preços:
          <b :class="s.priceEffect > 0 ? 'up-text' : 'down-text'">
            {{ s.priceEffect > 0 ? `as subidas custaram ${mt(s.priceEffect)}` : `os preços mais baixos pouparam ${mt(-s.priceEffect)}` }}</b>
        </p>
      </div>

      <!-- Meta de poupança -->
      <div v-if="s.goal" class="card stack">
        <h2>🎯 Meta: poupar {{ mt(s.goal) }}</h2>
        <p v-if="s.savedVsPrev != null && s.savedVsPrev >= s.goal" class="verdict good">🎉 Parabéns! Pouparam {{ mt(s.savedVsPrev) }} no rancho face a {{ monthLabel(prev.month) }}.</p>
        <p v-else-if="s.savedVsPrev != null && s.savedVsPrev > 0" class="verdict bad">Pouparam {{ mt(s.savedVsPrev) }}: faltaram {{ mt(s.goal - s.savedVsPrev) }} para a meta. Quase lá!</p>
        <p v-else-if="s.savedVsPrev != null" class="verdict bad">Este mês o rancho custou {{ mt(-s.savedVsPrev) }} mais que em {{ monthLabel(prev.month) }}.</p>
      </div>

      <!-- Subidas e descidas -->
      <div v-if="s.up.length" class="card stack">
        <h2>🔴 O que subiu ({{ s.up.length }})</h2>
        <ul class="history">
          <li v-for="c in (showAll ? s.up : s.up.slice(0, 5))" :key="'u' + c.name">
            <div>{{ c.name }}<div class="muted small">{{ mt(c.from) }} → {{ mt(c.to) }} · {{ c.store }}</div></div>
            <b class="up-text">+{{ mt(c.diff) }} <span class="small">({{ pct(c.pct) }})</span></b>
          </li>
        </ul>
      </div>
      <div v-if="s.down.length" class="card stack">
        <h2>🟢 O que desceu ({{ s.down.length }})</h2>
        <ul class="history">
          <li v-for="c in (showAll ? s.down : s.down.slice(0, 5))" :key="'d' + c.name">
            <div>{{ c.name }}<div class="muted small">{{ mt(c.from) }} → {{ mt(c.to) }} · {{ c.store }}</div></div>
            <b class="down-text">−{{ mt(-c.diff) }} <span class="small">({{ pct(c.pct) }})</span></b>
          </li>
        </ul>
      </div>
      <button v-if="s.up.length > 5 || s.down.length > 5" class="link" @click="showAll = !showAll">{{ showAll ? 'Mostrar menos' : 'Ver todas as subidas e descidas' }}</button>

      <!-- Conquistas -->
      <div v-if="trophies.withBudget || trophies.goals || trophies.priceSavings > 0" class="card stack">
        <h2>🏆 Conquistas</h2>
        <div class="trophies">
          <div v-if="trophies.withBudget" class="trophy"><b>{{ trophies.withinBudget }}/{{ trophies.withBudget }}</b><span class="small muted">meses com o rancho dentro do limite</span></div>
          <div v-if="trophies.goals" class="trophy"><b>{{ trophies.goalsMet }}/{{ trophies.goals }}</b><span class="small muted">metas de poupança cumpridas</span></div>
          <div v-if="trophies.priceSavings > 0" class="trophy"><b>{{ mt(trophies.priceSavings) }}</b><span class="small muted">poupados com preços mais baixos</span></div>
          <div v-if="trophies.bestSaving > 0" class="trophy"><b>{{ mt(trophies.bestSaving) }}</b><span class="small muted">melhor poupança num mês</span></div>
        </div>
      </div>

      <!-- Por loja -->
      <div v-if="s.stores.length" class="card stack">
        <h2>🏪 Gasto por loja</h2>
        <div v-for="st in s.stores" :key="st.name" class="store-bar">
          <div class="small"><span>{{ st.name }}</span><b>{{ mt(st.value) }}</b></div>
          <div class="bar"><span :style="{ width: Math.round(st.value / s.stores[0].value * 100) + '%' }"></span></div>
        </div>
      </div>
    </template>
    <p v-else class="muted">A carregar…</p>
  </section>
</template>
