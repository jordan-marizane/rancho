<script setup>
import { ref, computed, reactive } from 'vue'
import Sheet from './Sheet.vue'
import Trend from './Trend.vue'
import { catalog, priceStats, storeName, saveProduct, archiveProduct, addPurchase, deletePurchase } from '../lib/catalog.js'
import { memberName } from '../lib/session.js'
import { mt, dayLabel, today } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'

const props = defineProps({ productId: { type: String, default: null }, presetName: { type: String, default: '' } })
const emit = defineEmits(['close', 'saved'])

const product = computed(() => catalog.products.find((p) => p.id === props.productId) ?? null)
const stats = computed(() => (product.value ? priceStats(product.value.id) : null))
const editing = ref(!props.productId)
const form = reactive({
  id: product.value?.id,
  name: product.value?.name ?? props.presetName,
  category_id: product.value?.category_id ?? '',
  unit: product.value?.unit ?? 'un',
})
const price = reactive({ store_id: stats.value?.last?.store_id ?? '', price: '', quantity: 1, purchased_on: today() })
const error = ref('')
const busy = ref(false)
const confirmArchive = ref(false)

const similar = computed(() => {
  if (product.value || form.name.trim().length < 3) return []
  const n = form.name.trim().toLowerCase()
  return catalog.products.filter((p) => p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase())).slice(0, 3)
})

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
const save = () => run(async () => {
  const saved = await saveProduct(form)
  editing.value = false
  emit('saved', saved)
})
const addPrice = () => run(async () => {
  await addPurchase({ product_id: product.value.id, ...price, price: Number(String(price.price).replace(',', '.')) })
  price.price = ''
})
const archive = () => run(async () => { await archiveProduct(product.value.id); emit('close') })
</script>

<template>
  <Sheet :title="product ? product.name : 'Novo produto'" @close="emit('close')">
    <!-- Resumo de preços -->
    <div v-if="product && !editing" class="stack">
      <div class="price-hero">
        <div>
          <div class="muted small">Último preço</div>
          <div class="big">{{ mt(stats.last?.price) }}</div>
          <div v-if="stats.last" class="muted small">{{ storeName(stats.last.store_id) }} · {{ dayLabel(stats.last.purchased_on) }}</div>
        </div>
        <Trend :diff="stats.diff" />
      </div>
      <p v-if="stats.cheapest && stats.cheapest.id !== stats.last?.id" class="msg ok">
        Mais barato nos últimos 6 meses: <b>{{ mt(stats.cheapest.price) }}</b> em {{ storeName(stats.cheapest.store_id) }}
      </p>

      <form class="card stack" @submit.prevent="addPrice">
        <h3>Registar preço</h3>
        <div class="row2">
          <label>Preço (MT)
            <input v-model="price.price" inputmode="decimal" required placeholder="0" pattern="[0-9]+([.,][0-9]{1,2})?" />
          </label>
          <label>Quantidade
            <input v-model.number="price.quantity" type="number" min="0.001" step="any" inputmode="decimal" required />
          </label>
        </div>
        <div class="row2">
          <label>Loja
            <select v-model="price.store_id">
              <option value="">Sem loja</option>
              <option v-for="s in catalog.stores" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label>Data
            <input v-model="price.purchased_on" type="date" required />
          </label>
        </div>
        <button class="btn primary" :disabled="busy">Guardar preço</button>
      </form>

      <div>
        <h3>Histórico</h3>
        <p v-if="!stats.history.length" class="muted">Ainda sem preços registados.</p>
        <ul class="history">
          <li v-for="h in stats.history" :key="h.id">
            <div>
              <b>{{ mt(h.price) }}</b><span v-if="Number(h.quantity) !== 1" class="muted"> × {{ Number(h.quantity) }}</span>
              <div class="muted small">{{ storeName(h.store_id) }} · {{ dayLabel(h.purchased_on) }} · {{ memberName(h.created_by) }}</div>
            </div>
            <button class="icon-btn" aria-label="Apagar este preço" @click="run(() => deletePurchase(h.id))">🗑</button>
          </li>
        </ul>
      </div>

      <div class="links">
        <button class="link" @click="editing = true">Editar produto</button>
        <button v-if="!confirmArchive" class="link danger" @click="confirmArchive = true">Remover produto</button>
        <button v-else class="link danger" @click="archive">Confirmar remoção</button>
      </div>
      <p v-if="error" class="msg error">{{ error }}</p>
    </div>

    <!-- Criar / editar -->
    <form v-else class="stack" @submit.prevent="save">
      <label>Nome
        <input v-model="form.name" required maxlength="100" autofocus placeholder="Ex.: Arroz 10 kg" />
      </label>
      <p v-if="similar.length" class="msg warn">Já existe: {{ similar.map((p) => p.name).join(', ') }}</p>
      <label>Categoria
        <select v-model="form.category_id">
          <option value="">Sem categoria</option>
          <option v-for="c in catalog.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label>Unidade
        <select v-model="form.unit">
          <option value="un">Unidade / embalagem</option>
          <option value="kg">Quilo (kg)</option>
          <option value="L">Litro (L)</option>
          <option value="monte">Monte</option>
        </select>
      </label>
      <p v-if="error" class="msg error">{{ error }}</p>
      <button class="btn primary" :disabled="busy">Guardar</button>
      <button v-if="product" type="button" class="btn" @click="editing = false">Cancelar</button>
    </form>
  </Sheet>
</template>
