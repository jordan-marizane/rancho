<script setup>
// Lista simples de nomes com "adicionar" e "mudar nome" (usada para lojas e categorias)
import { ref } from 'vue'
import { friendlyError } from '../lib/errors.js'

const props = defineProps({
  title: String,
  items: Array,
  placeholder: String,
  kinds: { type: Array, default: null }, // opções extra (ex.: tipo de loja)
  onAdd: Function,
  onUpdate: Function,
})
const name = ref('')
const kind = ref(props.kinds?.[0]?.value)
const editId = ref(null)
const editName = ref('')
const error = ref('')

async function run(fn) {
  error.value = ''
  try { await fn() } catch (e) { error.value = friendlyError(e) }
}
const add = () => run(async () => { await props.onAdd(name.value, kind.value); name.value = '' })
const startEdit = (it) => { editId.value = it.id; editName.value = it.name }
const saveEdit = (it) => run(async () => { await props.onUpdate(it.id, { name: editName.value.trim() }); editId.value = null })
</script>

<template>
  <div class="card stack">
    <h2>{{ title }}</h2>
    <ul class="plain editlist">
      <li v-for="it in items" :key="it.id">
        <form v-if="editId === it.id" class="inline" @submit.prevent="saveEdit(it)">
          <input v-model="editName" required maxlength="80" />
          <button class="btn primary">OK</button>
        </form>
        <template v-else>
          <span>{{ it.name }}</span>
          <select v-if="kinds" :value="it.kind" aria-label="Tipo" class="mini"
                  @change="run(() => onUpdate(it.id, { kind: $event.target.value }))">
            <option v-for="k in kinds" :key="k.value" :value="k.value">{{ k.label }}</option>
          </select>
          <button class="icon-btn" aria-label="Mudar nome" @click="startEdit(it)">✏️</button>
        </template>
      </li>
    </ul>
    <form class="inline" @submit.prevent="add">
      <input v-model="name" required maxlength="80" :placeholder="placeholder" />
      <button class="btn primary">Adicionar</button>
    </form>
    <p v-if="error" class="msg error">{{ error }}</p>
  </div>
</template>
