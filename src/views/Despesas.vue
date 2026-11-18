<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import Sheet from '../components/Sheet.vue'
import StartMonth from '../components/StartMonth.vue'
import { rancho, loadRancho, startMonth } from '../lib/rancho.js'
import { despesas, loadDespesas, addFixed, updateMonthItem, togglePaid, removeItem, fixedSummary } from '../lib/despesas.js'
import { memberName } from '../lib/session.js'
import { mt, monthLabel, dayLabel } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'

const error = ref('')
const busy = ref(false)
const adding = ref(false)
const editing = ref(null)
const form = reactive({ name: '', amount: '', due_day: '' })
const edit = reactive({ name: '', amount: '', due_day: '', also: true, confirmRemove: false })

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

const begin = () => run(async () => { await startMonth(); await loadDespesas() })
const add = () => run(async () => {
  await addFixed({ name: form.name, amount: num(form.amount), due_day: form.due_day ? Number(form.due_day) : null })
  Object.assign(form, { name: '', amount: '', due_day: '' }); adding.value = false
})
function openEdit(item) {
  editing.value = item
  Object.assign(edit, { name: item.name, amount: String(Number(item.amount)), due_day: item.due_day ?? '', also: true, confirmRemove: false })
}
const saveEdit = () => run(async () => {
  await updateMonthItem(editing.value, { name: edit.name.trim(), amount: num(edit.amount), due_day: edit.due_day ? Number(edit.due_day) : null }, edit.also)
  editing.value = null
})
const remove = (stop) => run(async () => { await removeItem(editing.value, stop); editing.value = null })
</script>

<template>
  <section class="stack">
    <div class="title-row">
      <h1>Despesas fixas <span class="muted month-name">{{ rancho.monthStart ? monthLabel(rancho.monthStart) : '' }}</span></h1>
      <button v-if="rancho.month" class="btn primary small-btn" @click="adding = true">+ Despesa</button>
    </div>
    <p v-if="error" class="msg error">{{ error }}</p>
    <p v-if="!rancho.loaded" class="muted">A carregar…</p>

    <StartMonth v-else-if="!rancho.month" @started="loadDespesas" />

    <template v-else>
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
        <p class="muted">Adicionem as despesas de todos os meses: renda, escola, empregados, mesada, combustível… Ficam guardadas e repetem-se automaticamente nos meses seguintes.</p>
        <button class="btn primary" @click="adding = true">+ Adicionar a primeira</button>
      </div>

      <ul v-else class="plist">
        <li v-for="d in sorted" :key="d.id" class="lrow" :class="{ done: d.paid_at }">
          <button class="check" :aria-label="d.paid_at ? 'Marcar como não paga' : 'Marcar como paga'" :disabled="busy"
                  @click="run(() => togglePaid(d))">{{ d.paid_at ? '✓' : '' }}</button>
          <button class="prow" @click="openEdit(d)">
            <span class="pname">{{ d.name }}</span>
            <span class="pprice">{{ mt(d.amount) }}</span>
            <span class="pmeta muted small">
              <template v-if="d.paid_at">Paga por {{ memberName(d.paid_by) }} · {{ dayLabel(d.paid_at.slice(0, 10)) }}</template>
              <template v-else-if="d.due_day">Vence dia {{ d.due_day }}</template>
              <template v-else>Sem dia fixo</template>
            </span>
            <span v-if="lateIds.has(d.id)" class="trend up">em atraso</span>
            <span v-else class="trend none"></span>
          </button>
        </li>
      </ul>
    </template>

    <Sheet v-if="adding" title="Nova despesa fixa" @close="adding = false">
      <form class="stack" @submit.prevent="add">
        <label>Nome <input v-model="form.name" required maxlength="80" placeholder="Ex.: Renda, Escola, Combustível" autofocus /></label>
        <div class="row2">
          <label>Valor (MT) <input v-model="form.amount" required inputmode="decimal" placeholder="0" /></label>
          <label>Dia de pagamento <input v-model="form.due_day" type="number" min="1" max="31" inputmode="numeric" placeholder="Opcional" /></label>
        </div>
        <p class="muted small">Repete-se todos os meses. Se num mês o valor for diferente, podem alterá-lo só nesse mês.</p>
        <button class="btn primary" :disabled="busy">Guardar</button>
      </form>
    </Sheet>

    <Sheet v-if="editing" :title="editing.name" @close="editing = null">
      <form class="stack" @submit.prevent="saveEdit">
        <label>Nome <input v-model="edit.name" required maxlength="80" /></label>
        <div class="row2">
          <label>Valor (MT) <input v-model="edit.amount" required inputmode="decimal" /></label>
          <label>Dia de pagamento <input v-model="edit.due_day" type="number" min="1" max="31" inputmode="numeric" /></label>
        </div>
        <label v-if="editing.fixed_expense_id" class="checkline">
          <input v-model="edit.also" type="checkbox" /> Aplicar também aos próximos meses
        </label>
        <button class="btn primary" :disabled="busy">Guardar</button>
        <button type="button" class="btn" :disabled="busy" @click="run(async () => { await togglePaid(editing); editing = null })">
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
  </section>
</template>
