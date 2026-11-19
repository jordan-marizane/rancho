<script setup>
// Adicionar à lista do rancho deste mês: um produto que já existe, ou um produto novo
// (com categoria, quantidade e preço previsto)
import { ref, reactive, computed } from 'vue'
import Sheet from './Sheet.vue'
import { catalog, saveProduct } from '../lib/catalog.js'
import { rancho, addToList, lastBefore } from '../lib/rancho.js'
import { mt, norm } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'

const props = defineProps({ storeFilter: { type: String, default: '' } })
const emit = defineEmits(['close', 'added'])
const q = ref('')
const error = ref('')
const busy = ref(false)
const creating = ref(false)
const form = reactive({ category_id: '', unit: 'un', qty: 1, price: '' })

const inList = computed(() => new Set(rancho.items.map((i) => i.product_id)))
const results = computed(() => {
  const t = norm(q.value)
  return catalog.products.filter((p) => !inList.value.has(p.id) && (!t || norm(p.name).includes(t))).slice(0, 30)
})
const exact = computed(() => catalog.products.some((p) => norm(p.name) === norm(q.value)))
const num = (v) => Number(String(v).replace(/\s/g, '').replace(',', '.'))
const priceOk = computed(() => String(form.price).trim() === '' || (Number.isFinite(num(form.price)) && num(form.price) >= 0))

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
// Produto que já existe: entra na lista e abre-se logo para ajustar a quantidade e o preço
const add = (p) => run(async () => { const item = await addToList(p.id, props.storeFilter || null); emit('added', item) })
function startCreate() { creating.value = true; Object.assign(form, { category_id: '', unit: 'un', qty: 1, price: '' }) }
const createAndAdd = () => run(async () => {
  const p = await saveProduct({ name: q.value, category_id: form.category_id || null, unit: form.unit })
  const price = String(form.price).trim() === '' ? null : num(form.price)
  await addToList(p.id, props.storeFilter || null, Number(form.qty) || 1, price)
  emit('added', null)
})
</script>

<template>
  <Sheet title="Adicionar à lista" @close="emit('close')">
    <div class="stack">
      <input :value="q" @input="q = $event.target.value; creating = false" type="search"
             placeholder="🔍 Procurar ou escrever produto novo" aria-label="Procurar ou escrever produto novo" autofocus />

      <button v-if="q.trim() && !exact && !creating" class="btn" :disabled="busy" @click="startCreate">+ Criar "{{ q.trim() }}"</button>

      <form v-if="creating" class="card stack" @submit.prevent="createAndAdd">
        <h3 style="margin:0">Novo: {{ q.trim() }}</h3>
        <label>Categoria
          <select v-model="form.category_id">
            <option value="">Sem categoria</option>
            <option v-for="c in catalog.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <div class="row2">
          <label>Quantidade <input v-model="form.qty" type="number" min="0.001" step="any" inputmode="decimal" required /></label>
          <label>Preço previsto (MT) <input v-model="form.price" inputmode="decimal" placeholder="Opcional" /></label>
        </div>
        <label>Unidade
          <select v-model="form.unit">
            <option value="un">Unidade / embalagem</option>
            <option value="kg">Quilo (kg)</option>
            <option value="L">Litro (L)</option>
            <option value="monte">Monte</option>
          </select>
        </label>
        <button class="btn primary" :disabled="busy || !priceOk || !(Number(form.qty) > 0)">Adicionar à lista</button>
      </form>

      <p v-if="error" class="msg error">{{ error }}</p>
      <ul v-if="!creating" class="plain pick">
        <li v-for="p in results" :key="p.id">
          <button class="link pick-row" :disabled="busy" @click="add(p)">
            <span>+ {{ p.name }}</span>
            <span class="muted small">{{ lastBefore(p.id) ? mt(lastBefore(p.id).price) : '' }}</span>
          </button>
        </li>
      </ul>
      <p v-if="!creating && !results.length && !q" class="muted">Todos os produtos já estão na lista.</p>
    </div>
  </Sheet>
</template>
