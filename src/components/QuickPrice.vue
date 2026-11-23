<script setup>
// Um produto da lista do rancho, em duas fases:
//  * em casa: ajustar quantidade e preço previsto ("Guardar na lista"), sem marcar como comprado
//  * na loja: "Comprei" regista o preço pago (já vem preenchido com o previsto)
import { ref, computed, onMounted } from 'vue'
import Sheet from './Sheet.vue'
import { catalog, storeName, addStore, setProductUnit } from '../lib/catalog.js'
import { rancho, buy, unbuy, removeFromList, savePlan, updateItem, boughtThisMonth, lastBefore, expectedPrice } from '../lib/rancho.js'
import { mt, monthLabel, dayLabel, today, qtyLabel, perUnit, parseNum } from '../lib/format.js'
import { memberName } from '../lib/session.js'
import { friendlyError } from '../lib/errors.js'

const props = defineProps({ item: Object, storeFilter: { type: String, default: '' } })
const emit = defineEmits(['close'])

const product = computed(() => catalog.products.find((p) => p.id === props.item.product_id))
const ref0 = computed(() => lastBefore(props.item.product_id))
const bought = computed(() => boughtThisMonth(props.item.product_id))
// A linha atualizada da lista (pode ter mudado noutro telemóvel)
const live = computed(() => rancho.items.find((i) => i.id === props.item.id) ?? props.item)
// Unidade escolhida na compra: Qtd (un), Kg ou Litro. Fica guardada no produto para a próxima vez.
const unitSel = ref(product.value?.unit ?? 'un')
const unit = computed(() => unitSel.value)
const unitChanged = computed(() => (unitSel.value === 'un' ? !['un', 'monte'].includes(product.value?.unit ?? 'un') : unitSel.value !== product.value?.unit))
const byWeight = computed(() => unit.value === 'kg' || unit.value === 'L')
const qtyName = computed(() => (unit.value === 'kg' ? 'Peso (kg)' : unit.value === 'L' ? 'Litros' : 'Quantidade'))
const expected = expectedPrice(props.item)

const priceInput = ref(null)
// Kg: escreve-se o peso e o total pago, e a app calcula o preço por kg.
// Qtd e Litro: quantidade × preço de 1 (ou por litro).
const mode = computed(() => (unit.value === 'kg' ? 'total' : 'unit'))
const qty = ref(String(Number(props.item.planned_qty)).replace('.', ','))
const qtyNum = computed(() => parseNum(qty.value))
const price = ref(expected != null ? fmtIn(mode.value === 'total' ? expected * Number(props.item.planned_qty) : expected) : '')
function fmtIn(v) { return String(Math.round(v * 100) / 100).replace('.', ',') }
const store = ref(props.storeFilter || props.item.store_id || ref0.value?.store_id || '')
const date = ref(today())
const showWhere = ref(false)
const busy = ref(false)
const error = ref('')
const confirmRemove = ref(false)
const newStore = ref(null) // null = fechado; texto = a escrever
const newStoreKind = ref('supermercado')
const saveStore = () => run(async () => {
  const s = await addStore(newStore.value, newStoreKind.value)
  store.value = s.id
  newStore.value = null
})

const entered = computed(() => parseNum(price.value))
const hasPrice = computed(() => String(price.value).trim() !== '')
const qtyOk = computed(() => Number.isFinite(qtyNum.value) && qtyNum.value > 0)
// Preço por unidade (ou por kg/L), arredondado aos cêntimos
const value = computed(() => {
  if (!hasPrice.value || !Number.isFinite(entered.value)) return NaN
  if (mode.value === 'unit') return entered.value
  // 4 casas decimais, para que peso × preço/kg volte a dar o total pago (migração 008)
  return qtyOk.value ? Math.round((entered.value / qtyNum.value) * 10000) / 10000 : NaN
})
const total = computed(() => (mode.value === 'total' ? entered.value : value.value * qtyNum.value))
const valid = computed(() => Number.isFinite(value.value) && value.value >= 0)
// Comparar com o último preço só faz sentido na mesma unidade
const diff = computed(() => (ref0.value && valid.value && !unitChanged.value ? value.value - Number(ref0.value.price) : null))
const planChanged = computed(() => qtyNum.value !== Number(props.item.planned_qty) ||
  (valid.value ? value.value : null) !== expected)
function setUnit(u) {
  if (u === unitSel.value) return
  const toTotal = u === 'kg', fromTotal = unitSel.value === 'kg'
  if (valid.value && qtyOk.value && toTotal !== fromTotal) price.value = fmtIn(toTotal ? value.value * qtyNum.value : value.value)
  unitSel.value = u
}
async function keepUnit() { if (unitChanged.value) await setProductUnit(product.value.id, unitSel.value) }

onMounted(() => { if (!ref0.value && !bought.value.length) priceInput.value?.focus() })

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
const plan = () => run(async () => {
  await keepUnit()
  await savePlan(props.item, { qty: qtyNum.value || 1, price: valid.value ? value.value : null })
  emit('close')
})
const purchase = () => run(async () => {
  await keepUnit()
  await buy(live.value, { price: value.value, quantity: qtyNum.value || 1, store_id: store.value, purchased_on: date.value })
  emit('close')
})
const undo = () => run(async () => { await unbuy(props.item) })
const remove = () => run(async () => { await removeFromList(props.item.id); emit('close') })
// Nos produtos ao peso o passo é 0,5 (kg/L); nos outros, 1
const step = (d) => {
  const inc = byWeight.value ? d * 0.5 : d
  const min = byWeight.value ? 0.1 : 1
  qty.value = fmtIn(Math.max(min, Math.round(((qtyNum.value || 0) + inc) * 1000) / 1000))
}
// Marcado no círculo (no cesto) sem preço registado
const inBasketNoPrice = computed(() => live.value.done && !bought.value.length)
const unmark = () => run(async () => { await updateItem(live.value.id, { done: false }) })
</script>

<template>
  <Sheet :title="product?.name ?? 'Produto'" @close="emit('close')">
    <div class="stack">
      <!-- Referência: mês anterior -->
      <div class="ref-box">
        <template v-if="ref0">
          <div class="muted small">{{ ref0.month_id ? 'Pagaste da última vez' : 'Último preço registado' }}</div>
          <div class="ref-line"><b>{{ mt(ref0.price) }}{{ perUnit(unit) }}</b><span v-if="Number(ref0.quantity) !== 1" class="muted"> × {{ qtyLabel(ref0.quantity, unit) }}</span> <span class="muted">· {{ storeName(ref0.store_id) }} · {{ monthLabel(ref0.purchased_on) }}</span></div>
        </template>
        <div v-else class="muted">Ainda sem preço anterior para este produto.</div>
        <div v-if="item.planned_price != null && !bought.length" class="small" style="margin-top:4px">📝 Previsto na lista: <b>{{ mt(item.planned_price) }}</b></div>
      </div>

      <!-- Já comprado este mês -->
      <div v-if="bought.length" class="msg ok">
        <div v-for="b in bought" :key="b.id">
          ✓ Comprado por <b>{{ memberName(b.created_by) }}</b>: {{ qtyLabel(b.quantity, unit) }} × {{ mt(b.price) }}{{ perUnit(unit) }} = <b>{{ mt(b.price * b.quantity) }}</b>
          · {{ storeName(b.store_id) }} · {{ dayLabel(b.purchased_on) }}
        </div>
        <button class="link" :disabled="busy" @click="undo">Desfazer (não comprei)</button>
      </div>

      <div v-else-if="inBasketNoPrice" class="msg ok">
        ✓ No cesto, sem preço · marcado por <b>{{ memberName(live.updated_by) }}</b>
        <div class="small">Podem registar o preço abaixo, ou</div>
        <button class="link" :disabled="busy" @click="unmark">Desfazer (tirar do cesto)</button>
      </div>

      <form v-if="!bought.length" class="stack" @submit.prevent="purchase">
        <div class="seg units" role="radiogroup" aria-label="Como se compra" style="margin:0">
          <button type="button" role="radio" :aria-checked="unit !== 'kg' && unit !== 'L'" :class="{ on: unit !== 'kg' && unit !== 'L' }" @click="setUnit('un')">Qtd</button>
          <button type="button" role="radio" :aria-checked="unit === 'kg'" :class="{ on: unit === 'kg' }" @click="setUnit('kg')">Kg</button>
          <button type="button" role="radio" :aria-checked="unit === 'L'" :class="{ on: unit === 'L' }" @click="setUnit('L')">Litro</button>
        </div>
        <div class="row2">
          <div>
            <span class="lbl">{{ qtyName }}</span>
            <div class="stepper">
              <button type="button" aria-label="Menos" @click="step(-1)">−</button>
              <input v-model="qty" inputmode="decimal" :aria-label="qtyName" @focus="$event.target.select()" />
              <button type="button" aria-label="Mais" @click="step(1)">+</button>
            </div>
          </div>
          <label>{{ unit === 'kg' ? 'Total pago (MT)' : unit === 'L' ? 'Preço por litro (MT)' : 'Preço de 1 (MT)' }}
            <input ref="priceInput" v-model="price" inputmode="decimal" class="price-input"
                   :placeholder="ref0 ? String(Number(ref0.price)) : '0'" aria-label="Preço em meticais" @focus="$event.target.select()" />
          </label>
        </div>
        <p v-if="valid && qtyOk" class="muted small" style="margin:0">
          <template v-if="mode === 'total'">{{ qtyLabel(qtyNum, unit) }} por {{ mt(total) }} = <b>{{ mt(value) }}/kg</b></template>
          <template v-else>Total: <b>{{ mt(total) }}</b></template>
        </p>
        <p v-if="diff != null && Math.abs(diff) >= 0.005" class="cmp" :class="diff > 0 ? 'up' : 'down'">
          {{ diff > 0 ? '🔴 Mais caro' : '🟢 Mais barato' }} {{ mt(Math.abs(diff)) }}{{ perUnit(unit) }}
          ({{ diff > 0 ? '+' : '−' }}{{ Math.round(Math.abs(diff) / Number(ref0.price) * 100) }}%) que da última vez
        </p>

        <button type="button" class="btn" :disabled="busy || !qtyOk || !planChanged" @click="plan">
          📝 Guardar na lista (ainda não comprei)
        </button>
        <button class="btn primary big-btn" :disabled="busy || !valid || !qtyOk">
          ✓ Comprei<template v-if="valid"> · {{ mode === 'total' || qtyNum !== 1 ? mt(total) : mt(value) }}</template>
        </button>

        <div>
          <button v-if="!showWhere" type="button" class="link small" @click="showWhere = true">
            Comprado em {{ store ? storeName(store) : 'loja por indicar' }} · {{ date === today() ? 'hoje' : dayLabel(date) }} (mudar)
          </button>
          <template v-else>
            <span class="lbl">Loja</span>
            <div class="chips">
              <button v-for="s in catalog.stores" :key="s.id" type="button" class="chip" :class="{ on: store === s.id }"
                      @click="store = s.id">{{ s.name }}</button>
              <button v-if="newStore === null" type="button" class="chip add" @click="newStore = ''">+ Nova loja</button>
            </div>
            <div v-if="newStore !== null" class="new-store">
              <input v-model="newStore" maxlength="80" placeholder="Nome da loja" aria-label="Nome da nova loja" autofocus
                     @keydown.enter.prevent="newStore.trim() && saveStore()" />
              <select v-model="newStoreKind" aria-label="Tipo de loja">
                <option value="supermercado">Supermercado</option>
                <option value="mercearia">Mercearia</option>
                <option value="mercado">Mercado</option>
                <option value="outro">Outro</option>
              </select>
              <div class="inline">
                <button type="button" class="btn primary" :disabled="busy || !newStore.trim()" @click="saveStore">Adicionar loja</button>
                <button type="button" class="btn" @click="newStore = null">Cancelar</button>
              </div>
            </div>
            <label style="margin-top:12px">Data <input v-model="date" type="date" required /></label>
          </template>
        </div>
      </form>

      <p v-if="error" class="msg error">{{ error }}</p>
      <div class="links">
        <button v-if="!confirmRemove" class="link danger" @click="confirmRemove = true">Tirar da lista deste mês</button>
        <button v-else class="link danger" @click="remove">Confirmar: tirar da lista</button>
      </div>
    </div>
  </Sheet>
</template>
