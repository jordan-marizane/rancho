<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { session } from '../lib/session.js'
import { friendlyError } from '../lib/errors.js'

const password = ref('')
const busy = ref(false)
const error = ref('')

async function save() {
  busy.value = true; error.value = ''
  try {
    if (password.value.length < 8) throw new Error('Password should be at least 8 characters')
    const { error: e } = await supabase.auth.updateUser({ password: password.value })
    if (e) throw e
    session.recovering = false
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="auth card">
    <h1>Nova palavra-passe</h1>
    <form @submit.prevent="save" class="stack">
      <label>Nova palavra-passe
        <input v-model="password" type="password" required minlength="8" autocomplete="new-password" />
      </label>
      <p v-if="error" class="msg error" role="alert">{{ error }}</p>
      <button class="btn primary" :disabled="busy">Guardar</button>
    </form>
  </section>
</template>
