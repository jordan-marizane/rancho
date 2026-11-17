<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { friendlyError } from '../lib/errors.js'

const mode = ref('entrar') // entrar | criar | recuperar
const name = ref('')
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const info = ref('')

const title = computed(() => ({ entrar: 'Entrar', criar: 'Criar conta', recuperar: 'Recuperar palavra-passe' })[mode.value])

function go(m) { mode.value = m; error.value = ''; info.value = '' }

async function submit() {
  error.value = ''; info.value = ''; busy.value = true
  try {
    if (mode.value === 'entrar') {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
      if (e) throw e
    } else if (mode.value === 'criar') {
      if (password.value.length < 8) throw new Error('Password should be at least 8 characters')
      const { data, error: e } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: { data: { display_name: name.value.trim() }, emailRedirectTo: window.location.origin },
      })
      if (e) throw e
      if (!data.session) info.value = 'Conta criada. Enviámos um email de confirmação: abre o link e depois entra aqui.'
    } else {
      const { error: e } = await supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: window.location.origin })
      if (e) throw e
      info.value = 'Se o email existir, vais receber um link para definir uma nova palavra-passe.'
    }
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="auth card">
    <h1>{{ title }}</h1>
    <form @submit.prevent="submit" class="stack">
      <label v-if="mode === 'criar'">O teu nome
        <input v-model="name" required maxlength="40" autocomplete="given-name" placeholder="Ex.: Jordan" />
      </label>
      <label>Email
        <input v-model="email" type="email" required autocomplete="email" inputmode="email" />
      </label>
      <label v-if="mode !== 'recuperar'">Palavra-passe
        <input v-model="password" type="password" required minlength="8"
               :autocomplete="mode === 'criar' ? 'new-password' : 'current-password'" />
      </label>
      <p v-if="error" class="msg error" role="alert">{{ error }}</p>
      <p v-if="info" class="msg ok" role="status">{{ info }}</p>
      <button class="btn primary" :disabled="busy">{{ busy ? 'Aguarde…' : title }}</button>
    </form>
    <div class="links">
      <button v-if="mode !== 'entrar'" class="link" @click="go('entrar')">Já tenho conta</button>
      <button v-if="mode !== 'criar'" class="link" @click="go('criar')">Criar conta nova</button>
      <button v-if="mode === 'entrar'" class="link" @click="go('recuperar')">Esqueci a palavra-passe</button>
    </div>
  </section>
</template>
