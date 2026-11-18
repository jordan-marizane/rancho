<script setup>
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'
import { catalog, saveProduct } from '../lib/catalog.js'
import { rancho, addToList } from '../lib/rancho.js'
import { norm } from '../lib/format.js'
import { friendlyError } from '../lib/errors.js'

const props = defineProps({ storeFilter: { type: String, default: '' } })
const emit = defineEmits(['close', 'added'])
const q = ref('')
const error = ref('')
const busy = ref(false)

const inList = computed(() => new Set(rancho.items.map((i) => i.product_id)))
const results = computed(() => {
  const t = norm(q.value)
  return catalog.products.filter((p) => !inList.value.has(p.id) && (!t || norm(p.name).includes(t))).slice(0, 30)
})
const exact = computed(() => catalog.products.some((p) => norm(p.name) === norm(q.value)))

async function run(fn) {
  error.value = ''; busy.value = true
  try { await fn() } catch (e) { error.value = friendlyError(e) } finally { busy.value = false }
}
const add = (p) => run(async () => { await addToList(p.id, props.storeFilter || null); emit('added', p) })
const createAndAdd = () => run(async () => {
  const p = await saveProduct({ name: q.value, category_id: null, unit: 'un' })
  await addToList(p.id, props.storeFilter || null)
  emit('added', p)
})
</script>

<template>
  <Sheet title="Adicionar à lista" @close="emit('close')">
    <div class="stack">
      <input :value="q" @input="q = $event.target.value" type="search" placeholder="🔍 Procurar ou escrever produto novo" autofocus />
      <button v-if="q.trim() && !exact" class="btn" :disabled="busy" @click="createAndAdd">+ Criar "{{ q.trim() }}" e adicionar</button>
      <p v-if="error" class="msg error">{{ error }}</p>
      <ul class="plain pick">
        <li v-for="p in results" :key="p.id"><button class="link" :disabled="busy" @click="add(p)">+ {{ p.name }}</button></li>
      </ul>
      <p v-if="!results.length && !q" class="muted">Todos os produtos já estão na lista.</p>
    </div>
  </Sheet>
</template>
