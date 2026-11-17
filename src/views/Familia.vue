<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { session, loadHousehold, displayNameFromUser, signOut } from '../lib/session.js'
import { friendlyError } from '../lib/errors.js'

const mode = ref('criar') // criar | juntar
const myName = ref(displayNameFromUser())
const familyName = ref('')
const code = ref(new URLSearchParams(window.location.search).get('convite') || '')
if (code.value) mode.value = 'juntar'
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true; error.value = ''
  try {
    const { error: e } = mode.value === 'criar'
      ? await supabase.rpc('create_household', { p_name: familyName.value, p_display_name: myName.value })
      : await supabase.rpc('join_household', { p_code: code.value, p_display_name: myName.value })
    if (e) throw e
    await loadHousehold()
    if (window.location.search) history.replaceState(null, '', window.location.pathname)
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="auth card">
    <h1>Bem-vindo{{ myName ? `, ${myName}` : '' }}!</h1>
    <p class="muted">Os dados ficam numa "família" partilhada. Cria uma nova ou entra na de quem te convidou.</p>

    <div class="seg" role="tablist">
      <button role="tab" :aria-selected="mode === 'criar'" :class="{ on: mode === 'criar' }" @click="mode = 'criar'">Criar família</button>
      <button role="tab" :aria-selected="mode === 'juntar'" :class="{ on: mode === 'juntar' }" @click="mode = 'juntar'">Tenho um código</button>
    </div>

    <form @submit.prevent="submit" class="stack">
      <label>O teu nome
        <input v-model="myName" required maxlength="40" />
      </label>
      <label v-if="mode === 'criar'">Nome da família
        <input v-model="familyName" required maxlength="80" placeholder="Ex.: Família Marizane" />
      </label>
      <label v-else>Código de convite
        <input v-model="code" required maxlength="12" autocapitalize="characters" class="code-input" placeholder="Ex.: 3F9A1C7B" />
      </label>
      <p v-if="error" class="msg error" role="alert">{{ error }}</p>
      <button class="btn primary" :disabled="busy">{{ mode === 'criar' ? 'Criar família' : 'Entrar na família' }}</button>
    </form>
    <div class="links"><button class="link" @click="signOut">Sair ({{ session.user?.email }})</button></div>
  </section>
</template>
