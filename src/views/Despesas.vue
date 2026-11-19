<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sheet from '../components/Sheet.vue'
import StartMonth from '../components/StartMonth.vue'
import { rancho, loadRancho, startMonth, setReserve } from '../lib/rancho.js'
import {
  despesas, loadDespesas, addFixed, updateMonthItem, togglePaid, removeItem, fixedSummary,
  isVariable, payVariable, setVariable, EXTRA_CATS, extraCat, addExtra, updateExtra, removeExtra, extraSummary,
} from '../lib/despesas.js'
import { memberName } from '../lib/session.js'
import { mt, monthLabel, dayLabel, today } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'

const route = useRoute()
const router = useRouter()
const tab = computed(() => (route.query.tab === 'outras' ? 'outras' : 'fixas'))
const setTab = (t) => router.replace({ query: t === 'outras' ? { tab: 'outras' } : {} })

const error = ref('')
const busy = ref(false)
const adding = ref(false)
const editing = ref(null)
const choosing = ref(false) // escolher entre despesa fixa e outra despesa
const paying = ref(null)
const payAmount = ref('')
const form = reactive({ name: '', amount: '', due_day: '', variable: false })
const edit = reactive({ name: '', amount: '', due_day: '', also: true, variable: false, confirmRemove: false })

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
onMounted(() => run(async () => { await loadRancho(); await loadDespesas() }))

const sum = computed(() => fixedSummary())
const lateIds = computed(() => new Set(sum.value.late.map((i) => i.id)))
// Por pagar em cima, pagas em baixo
const sorted = computed(() => [...despesas.items].sort((a, b) => (!!a.paid_at - !!b.paid_at) || ((a.due_day ?? 99) - (b.due_day ?? 99))))
const num = (v) => Number(String(v).replace(/\s/g, '').replace(',', '.'))
const valid = (v) => String(v).trim() !== '' && Number.isFinite(num(v)) && num(v) >= 0

const add = () => run(async () => {
  await addFixed({ name: form.name, amount: num(form.amount), due_day: form.due_day ? Number(form.due_day) : null, variable: form.variable })
  Object.assign(form, { name: '', amount: '', due_day: '', variable: false }); adding.value = false
})
function openEdit(item) {
  editing.value = item
  Object.assign(edit, { name: item.name, amount: String(Number(item.amount)), due_day: item.due_day ?? '', also: true, variable: isVariable(item), confirmRemove: false })
}
const saveEdit = () => run(async () => {
  const item = editing.value
  if (edit.variable !== isVariable(item)) await setVariable(item, edit.variable)
  await updateMonthItem(item, { name: edit.name.trim(), amount: num(edit.amount), due_day: edit.due_day ? Number(edit.due_day) : null }, edit.also)
  editing.value = null
})
const remove = (stop) => run(async () => { await removeItem(editing.value, stop); editing.value = null })

// Marcar como paga: nas contas de valor variável, pergunta primeiro quanto foi
function onCheck(item) {
  if (!item.paid_at && isVariable(item)) { paying.value = item; payAmount.value = String(Number(item.amount)); return }
  run(() => togglePaid(item))
}
const confirmPay = () => run(async () => { await payVariable(paying.value, num(payAmount.value)); paying.value = null; editing.value = null })

// ---- Outras despesas (imprevistos, recargas Credelec…) ----
const ex = computed(() => extraSummary())
const addingExtra = ref(false)
const editingExtra = ref(null)
const xf = reactive({ name: '', amount: '', category: 'outros', spent_on: today(), confirmRemove: false })
const reserveEdit = ref(false)
const reserveInput = ref('')

function openExtra(e = null) {
  editingExtra.value = e
  Object.assign(xf, e
    ? { name: e.name, amount: String(Number(e.amount)), category: e.category, spent_on: e.spent_on, confirmRemove: false }
    : { name: '', amount: '', category: 'outros', spent_on: today(), confirmRemove: false })
  addingExtra.value = true
}
// Escolher "Energia" com o nome vazio sugere a recarga
watch(() => xf.category, (c) => { if (c === 'energia' && !xf.name.trim()) xf.name = 'Recarga Credelec' })
const saveExtra = () => run(async () => {
  const fields = { name: xf.name, amount: num(xf.amount), category: xf.category, spent_on: xf.spent_on || today() }
  if (editingExtra.value) await updateExtra(editingExtra.value.id, { ...fields, name: fields.name.trim() })
  else await addExtra(fields)
  addingExtra.value = false; editingExtra.value = null
})
const deleteExtra = () => run(async () => { await removeExtra(editingExtra.value.id); addingExtra.value = false; editingExtra.value = null })
function openReserve() { reserveInput.value = rancho.month?.reserve_budget ?? ''; reserveEdit.value = true }
const saveReserve = () => run(async () => {
  await setReserve(String(reserveInput.value).trim() === '' ? null : num(reserveInput.value)); reserveEdit.value = false
})
const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0)
</script>

<template>
  <section class="stack">
    <div class="title-row">
      <h1>Despesas <span class="muted month-name">{{ rancho.monthStart ? monthLabel(rancho.monthStart) : '' }}</span></h1>
      <button v-if="rancho.month" class="btn primary small-btn" @click="choosing = true">+ Despesa</button>
    </div>
    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="!rancho.loaded" class="muted">A carregar…</p>

    <StartMonth v-else-if="!rancho.month" @started="loadDespesas" />

    <template v-else>
      <div class="seg" role="tablist" style="margin:0">
        <button role="tab" :aria-selected="tab === 'fixas'" :class="{ on: tab === 'fixas' }" @click="setTab('fixas')">Fixas · {{ mt(sum.total) }}</button>
        <button role="tab" :aria-selected="tab === 'outras'" :class="{ on: tab === 'outras' }" @click="setTab('outras')">Outras · {{ mt(ex.total) }}</button>
      </div>

      <!-- ===== Fixas ===== -->
      <template v-if="tab === 'fixas'">
        <div class="card summary">
          <div class="sum-grid">
            <div><div class="muted small">Total</div><b>{{ mt(sum.total) }}</b></div>
            <div><div class="muted small">Pago</div><b>{{ mt(sum.paid) }}</b></div>
            <div><div class="muted small">Por pagar</div><b>{{ mt(sum.unpaid) }}</b></div>
          </div>
          <div class="bar"><span :style="{ width: (sum.total ? Math.round(sum.paid / sum.total * 100) : 0) + '%' }"></span></div>
          <div class="muted small">{{ sum.paidCount }} de {{ sum.count }} pagas
            <span v-if="sum.late.length" class="up-text"> · {{ sum.late.length }} em atraso</span></div>
        </div>

        <div v-if="!despesas.items.length" class="card stack">
          <h2>Ainda não há despesas fixas</h2>
          <p class="muted">Adicionem as despesas de todos os meses: renda, escola, empregados, mesada, combustível, água, energia… Ficam guardadas e repetem-se automaticamente nos meses seguintes.</p>
          <button class="btn primary" @click="adding = true">+ Adicionar a primeira</button>
        </div>

        <ul v-else class="plist">
          <li v-for="d in sorted" :key="d.id" class="lrow" :class="{ done: d.paid_at }">
            <button class="check" :aria-label="d.paid_at ? 'Marcar como não paga' : 'Marcar como paga'" :disabled="busy"
                    @click="onCheck(d)">{{ d.paid_at ? '✓' : '' }}</button>
            <button class="prow" @click="openEdit(d)">
              <span class="pname">{{ d.name }}</span>
              <span class="pprice">{{ !d.paid_at && isVariable(d) ? '≈ ' : '' }}{{ mt(d.amount) }}</span>
              <span class="pmeta muted small">
                <template v-if="d.paid_at">Paga por {{ memberName(d.paid_by) }} · {{ dayLabel(d.paid_at.slice(0, 10)) }}</template>
                <template v-else>
                  {{ d.due_day ? `Vence dia ${d.due_day}` : 'Sem dia fixo' }}{{ isVariable(d) ? ' · valor estimado' : '' }}
                </template>
              </span>
              <span v-if="lateIds.has(d.id)" class="trend up">em atraso</span>
              <span v-else class="trend none"></span>
            </button>
          </li>
        </ul>
        <p v-if="despesas.items.length" class="muted small">Contas como a água e a energia: marquem "o valor varia". Ao pagar, a app pergunta quanto foi.</p>
      </template>

      <!-- ===== Outras ===== -->
      <template v-else>
        <p v-if="!despesas.extrasReady" class="msg error">Falta atualizar a base de dados: corram o ficheiro 006_despesas_variaveis.sql no Supabase.</p>
        <div class="card stack">
          <div class="title-row"><h2>Imprevistos do mês</h2><button class="link" @click="openReserve">{{ ex.reserve != null ? 'mudar reserva' : 'definir reserva' }}</button></div>
          <div class="sum-grid">
            <div><div class="muted small">Gasto</div><b>{{ mt(ex.total) }}</b></div>
            <div><div class="muted small">Reserva</div><b>{{ ex.reserve != null ? mt(ex.reserve) : '—' }}</b></div>
            <div><div class="muted small">{{ ex.left != null && ex.left < 0 ? 'Passou' : 'Sobra' }}</div>
              <b :class="{ 'up-text': ex.left != null && ex.left < 0 }">{{ ex.left != null ? mt(Math.abs(ex.left)) : '—' }}</b></div>
          </div>
          <div v-if="ex.reserve" class="bar" :class="{ over: ex.total > ex.reserve }"><span :style="{ width: pct(ex.total, ex.reserve) + '%' }"></span></div>
          <p v-if="ex.reserve == null" class="muted small" style="margin:0">Uma reserva (ex.: 3 000 MT) entra no orçamento do mês e mostra quanto ainda há para imprevistos.</p>
          <form v-if="reserveEdit" class="row-form" @submit.prevent="saveReserve">
            <input v-model="reserveInput" inputmode="numeric" placeholder="Ex.: 3000" aria-label="Reserva para imprevistos (MT)" autofocus />
            <button class="btn primary" :disabled="busy">Guardar</button>
          </form>
          <div v-if="ex.byCat.length" class="chips">
            <span v-for="c in ex.byCat" :key="c.id" class="chip static">{{ c.icon }} {{ c.label }} · {{ mt(c.value) }}</span>
          </div>
        </div>

        <div v-if="!despesas.extras.length" class="card stack">
          <h2>Nada lançado este mês</h2>
          <p class="muted">Lancem aqui o que aparece fora das fixas e do rancho: recargas Credelec, farmácia, reparações, aniversários…</p>
          <button class="btn primary" :disabled="!despesas.extrasReady" @click="openExtra()">+ Lançar despesa</button>
        </div>
        <ul v-else class="plist">
          <li v-for="e in despesas.extras" :key="e.id" class="lrow">
            <span class="cat-icon" aria-hidden="true">{{ extraCat(e.category).icon }}</span>
            <button class="prow" @click="openExtra(e)">
              <span class="pname">{{ e.name }}</span>
              <span class="pprice">{{ mt(e.amount) }}</span>
              <span class="pmeta muted small">{{ dayLabel(e.spent_on) }} · {{ extraCat(e.category).label }} · {{ memberName(e.created_by) }}</span>
              <span class="trend none"></span>
            </button>
          </li>
        </ul>
      </template>
    </template>

    <Sheet v-if="choosing" title="Que despesa é?" @close="choosing = false">
      <div class="stack">
        <button class="btn choice" @click="choosing = false; setTab('outras'); openExtra()">
          <b>📌 Outra despesa (só este mês)</b><span class="muted small">Recarga Credelec, farmácia, reparação, prenda…</span>
        </button>
        <button class="btn choice" @click="choosing = false; setTab('fixas'); adding = true">
          <b>📅 Despesa fixa (todos os meses)</b><span class="muted small">Renda, escola, água, energia por fatura…</span>
        </button>
      </div>
    </Sheet>

    <Sheet v-if="adding" title="Nova despesa fixa" @close="adding = false">
      <form class="stack" @submit.prevent="add">
        <label>Nome <input v-model="form.name" required maxlength="80" placeholder="Ex.: Renda, Escola, Água" autofocus /></label>
        <div class="row2">
          <label>{{ form.variable ? 'Valor estimado (MT)' : 'Valor (MT)' }} <input v-model="form.amount" required inputmode="decimal" placeholder="0" /></label>
          <label>Dia de pagamento <input v-model="form.due_day" type="number" min="1" max="31" inputmode="numeric" placeholder="Opcional" /></label>
        </div>
        <label class="checkline"><input v-model="form.variable" type="checkbox" /> O valor varia todos os meses (água, energia…)</label>
        <p class="muted small">Repete-se todos os meses.<template v-if="form.variable"> Ao marcar como paga, a app pergunta o valor real, e esse valor passa a ser a estimativa do mês seguinte.</template></p>
        <button class="btn primary" :disabled="busy || !valid(form.amount)">Guardar</button>
      </form>
    </Sheet>

    <Sheet v-if="editing" :title="editing.name" @close="editing = null">
      <form class="stack" @submit.prevent="saveEdit">
        <label>Nome <input v-model="edit.name" required maxlength="80" /></label>
        <div class="row2">
          <label>Valor (MT) <input v-model="edit.amount" required inputmode="decimal" /></label>
          <label>Dia de pagamento <input v-model="edit.due_day" type="number" min="1" max="31" inputmode="numeric" /></label>
        </div>
        <template v-if="editing.fixed_expense_id">
          <label class="checkline"><input v-model="edit.variable" type="checkbox" /> O valor varia todos os meses</label>
          <label class="checkline"><input v-model="edit.also" type="checkbox" /> Aplicar também aos próximos meses</label>
        </template>
        <button class="btn primary" :disabled="busy || !valid(edit.amount)">Guardar</button>
        <button type="button" class="btn" :disabled="busy" @click="editing.paid_at ? run(async () => { await togglePaid(editing); editing = null }) : onCheck(editing)">
          {{ editing.paid_at ? 'Marcar como não paga' : 'Marcar como paga' }}
        </button>
        <div class="links">
          <button v-if="!edit.confirmRemove" type="button" class="link danger" @click="edit.confirmRemove = true">Remover…</button>
          <template v-else>
            <button type="button" class="link danger" @click="remove(false)">Só deste mês</button>
            <button v-if="editing.fixed_expense_id" type="button" class="link danger" @click="remove(true)">Deste mês e não repetir mais</button>
          </template>
        </div>
      </form>
    </Sheet>

    <Sheet v-if="paying" :title="`Quanto foi ${paying.name}?`" @close="paying = null">
      <form class="stack" @submit.prevent="confirmPay">
        <label>Valor pago (MT) <input v-model="payAmount" required inputmode="decimal" class="price-input" autofocus /></label>
        <p class="muted small" style="margin:0">Estimativa era {{ mt(paying.amount) }}. O valor pago passa a ser a estimativa do mês seguinte.</p>
        <button class="btn primary" :disabled="busy || !valid(payAmount)">Marcar como paga</button>
      </form>
    </Sheet>

    <Sheet v-if="addingExtra" :title="editingExtra ? 'Editar despesa' : 'Nova despesa'" @close="addingExtra = false; editingExtra = null">
      <form class="stack" @submit.prevent="saveExtra">
        <div class="chips" role="radiogroup" aria-label="Categoria">
          <button v-for="c in EXTRA_CATS" :key="c.id" type="button" class="chip" :class="{ on: xf.category === c.id }"
                  role="radio" :aria-checked="xf.category === c.id" @click="xf.category = c.id">{{ c.icon }} {{ c.label }}</button>
        </div>
        <label>O quê <input v-model="xf.name" required maxlength="80" placeholder="Ex.: Farmácia, Canalizador, Prenda" /></label>
        <div class="row2">
          <label>Valor (MT) <input v-model="xf.amount" required inputmode="decimal" placeholder="0" class="price-input" /></label>
          <label>Data <input v-model="xf.spent_on" type="date" required /></label>
        </div>
        <p v-if="editingExtra" class="muted small" style="margin:0">Lançada por {{ memberName(editingExtra.created_by) }}</p>
        <button class="btn primary" :disabled="busy || !valid(xf.amount) || num(xf.amount) <= 0">Guardar</button>
        <div v-if="editingExtra" class="links">
          <button v-if="!xf.confirmRemove" type="button" class="link danger" @click="xf.confirmRemove = true">Apagar…</button>
          <button v-else type="button" class="link danger" @click="deleteExtra">Sim, apagar esta despesa</button>
        </div>
      </form>
    </Sheet>
  </section>
</template>
