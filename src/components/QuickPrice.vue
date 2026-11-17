<script setup>
// Registo rápido na loja: o último preço já vem preenchido.
// "Mesmo preço" = 1 toque. Caso contrário, escrever o valor e guardar.
import { ref, computed, onMounted } from 'vue'
import Sheet from './Sheet.vue'
import { catalog, storeName } from '../lib/catalog.js'
import { rancho, buy, unbuy, removeFromList, updateItem, boughtThisMonth, lastBefore } from '../lib/rancho.js'
import { mt, monthLabel, dayLabel, today } from '../lib/format.js'
import { memberName } from '../lib/session.js'
import { friendlyError } from '../lib/errors.js'

const props = defineProps({ item: Object, storeFilter: { type: String, default: '' } })
const emit = defineEmits(['close'])

const product = computed(() => catalog.products.find((p) => p.id === props.item.product_id))
const ref0 = computed(() => lastBefore(props.item.product_id))
const bought = computed(() => boughtThisMonth(props.item.product_id))

const priceInput = ref(null)
const price = ref(ref0.value ? String(Number(ref0.value.price)) : '')
const qty = ref(Number(props.item.planned_qty))
const store = ref(props.storeFilter || props.item.store_id || ref0.value?.store_id || '')
const date = ref(today())
const busy = ref(false)
const error = ref('')
const confirmRemove = ref(false)

const value = computed(() => Number(String(price.value).replace(',', '.')))
const valid = computed(() => String(price.value).trim() !== '' && Number.isFinite(value.value) && value.value >= 0)
const diff = computed(() => (ref0.value && valid.value ? value.value - Number(ref0.value.price) : null))

onMounted(() => { if (!ref0.value) priceInput.value?.focus() })

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
const save = (samePrice = false) => run(async () => {
  const p = samePrice ? Number(ref0.value.price) : value.value
  await buy(props.item, { price: p, quantity: qty.value || 1, store_id: store.value, purchased_on: date.value })
  emit('close')
})
const undo = () => run(async () => { await unbuy(props.item); })
const remove = () => run(async () => { await removeFromList(props.item.id); emit('close') })
const saveQty = () => run(() => updateItem(props.item.id, { planned_qty: qty.value || 1 }))
const step = (d) => { qty.value = Math.max(1, Math.round((Number(qty.value) + d) * 1000) / 1000) }
</script>

<template>
  <Sheet :title="product?.name ?? 'Produto'" @close="emit('close')">
    <div class="stack">
      <!-- Referência: mês anterior -->
      <div class="ref-box">
        <template v-if="ref0">
          <div class="muted small">Pagaste da última vez</div>
          <div class="ref-line"><b>{{ mt(ref0.price) }}</b> <span class="muted">· {{ storeName(ref0.store_id) }} · {{ monthLabel(ref0.purchased_on) }}</span></div>
        </template>
        <div v-else class="muted">Ainda sem preço anterior para este produto.</div>
      </div>

      <!-- Já comprado este mês -->
      <div v-if="bought.length" class="msg ok">
        <div v-for="b in bought" :key="b.id">
          ✓ Comprado: <b>{{ mt(b.price) }}</b><span v-if="Number(b.quantity) !== 1"> × {{ Number(b.quantity) }}</span>
          · {{ storeName(b.store_id) }} · {{ dayLabel(b.purchased_on) }} · {{ memberName(b.created_by) }}
        </div>
        <button class="link" :disabled="busy" @click="undo">Desfazer (não comprei)</button>
      </div>

      <form v-else class="stack" @submit.prevent="save(false)">
        <button v-if="ref0" type="button" class="btn primary big-btn" :disabled="busy" @click="save(true)">
          ✓ Mesmo preço · {{ mt(ref0.price) }}
        </button>

        <label>{{ ref0 ? 'Ou preço de hoje (MT)' : 'Preço de hoje (MT)' }}
          <input ref="priceInput" v-model="price" inputmode="decimal" class="price-input" required
                 pattern="[0-9]+([.,][0-9]{1,2})?" aria-label="Preço em meticais" @focus="$event.target.select()" />
        </label>
        <p v-if="diff != null && Math.abs(diff) >= 0.005" class="cmp" :class="diff > 0 ? 'up' : 'down'">
          {{ diff > 0 ? '🔴 Mais caro' : '🟢 Mais barato' }} {{ mt(Math.abs(diff)) }}
          ({{ diff > 0 ? '+' : '−' }}{{ Math.round(Math.abs(diff) / Number(ref0.price) * 100) }}%)
        </p>
        <p v-else-if="diff != null" class="cmp same">= Mesmo preço</p>

        <div class="row2">
          <div>
            <span class="lbl">Quantidade</span>
            <div class="stepper">
              <button type="button" aria-label="Menos" @click="step(-1)">−</button>
              <input v-model.number="qty" type="number" min="0.001" step="any" inputmode="decimal" aria-label="Quantidade" @change="saveQty" />
              <button type="button" aria-label="Mais" @click="step(1)">+</button>
            </div>
          </div>
          <label>Data
            <input v-model="date" type="date" required />
          </label>
        </div>

        <div>
          <span class="lbl">Loja</span>
          <div class="chips">
            <button v-for="s in catalog.stores" :key="s.id" type="button" class="chip" :class="{ on: store === s.id }"
                    @click="store = s.id">{{ s.name }}</button>
          </div>
        </div>

        <p v-if="valid && qty > 1" class="muted small">Total: {{ mt(value * qty) }}</p>
        <button class="btn primary" :disabled="busy || !valid">Guardar preço</button>
      </form>

      <p v-if="error" class="msg error">{{ error }}</p>
      <div class="links">
        <button v-if="!confirmRemove" class="link danger" @click="confirmRemove = true">Tirar da lista deste mês</button>
        <button v-else class="link danger" @click="remove">Confirmar: tirar da lista</button>
      </div>
    </div>
  </Sheet>
</template>
