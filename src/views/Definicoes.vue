<script setup>
import { ref, computed, onMounted } from 'vue'
import NameListEditor from '../components/NameListEditor.vue'
import { catalog, loadCatalog, addStore, updateStore, addCategory, updateCategory } from '../lib/catalog.js'

const storeKinds = [
  { value: 'supermercado', label: 'Supermercado' },
  { value: 'mercearia', label: 'Mercearia' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'outro', label: 'Outro' },
]
onMounted(() => isConfigured && session.household && loadCatalog())
import { supabase, isConfigured } from '../lib/supabase.js'
import { session, signOut } from '../lib/session.js'
import { friendlyError } from '../lib/errors.js'

const copied = ref(false)
const error = ref('')
const inviteLink = computed(() => session.household
  ? `${window.location.origin}/?convite=${session.household.invite_code}` : '')
const isOwner = computed(() => session.member?.role === 'owner')

async function share() {
  const text = `Junta-te à nossa família no Rancho: ${inviteLink.value}\nCódigo: ${session.household.invite_code}`
  try {
    if (navigator.share) await navigator.share({ title: 'Rancho', text })
    else { await navigator.clipboard.writeText(text); copied.value = true; setTimeout(() => (copied.value = false), 2000) }
  } catch { /* partilha cancelada */ }
}

async function newCode() {
  error.value = ''
  const { data, error: e } = await supabase.rpc('rotate_invite_code', { hid: session.household.id })
  if (e) error.value = friendlyError(e)
  else session.household.invite_code = data
}
</script>

<template>
  <section class="stack">
    <h1>Definições</h1>

    <p v-if="!isConfigured" class="muted">Disponível quando a base de dados estiver ligada.</p>

    <template v-else-if="session.household">
      <div class="card stack">
        <h2>{{ session.household.name }}</h2>
        <ul class="plain">
          <li v-for="m in session.members" :key="m.user_id">
            {{ m.display_name }}<span v-if="m.user_id === session.user.id" class="muted"> (tu)</span>
            <span v-if="m.role === 'owner'" class="tag">dono</span>
          </li>
        </ul>
      </div>

      <div class="card stack">
        <h2>Convidar</h2>
        <p class="muted">Envia este código ou link a quem deve partilhar os dados contigo.</p>
        <p class="code">{{ session.household.invite_code }}</p>
        <button class="btn primary" @click="share">{{ copied ? 'Copiado!' : 'Partilhar convite' }}</button>
        <button v-if="isOwner" class="btn" @click="newCode">Gerar novo código</button>
        <p v-if="error" class="msg error">{{ error }}</p>
      </div>

      <div class="card stack">
        <h2>Conta</h2>
        <p class="muted">{{ session.user.email }}</p>
        <button class="btn" @click="signOut">Sair</button>
      </div>

      <NameListEditor title="Lojas" :items="catalog.stores" placeholder="Nova loja" :kinds="storeKinds"
                      :on-add="addStore" :on-update="updateStore" />
      <NameListEditor title="Categorias" :items="catalog.categories" placeholder="Nova categoria"
                      :on-add="(n) => addCategory(n)" :on-update="updateCategory" />

      <p class="muted small">Orçamento e exportação para Excel chegam nas próximas etapas.</p>
    </template>
  </section>
</template>
