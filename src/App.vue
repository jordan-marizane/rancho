<script setup>
import { onMounted } from 'vue'
import { pages } from './router.js'
import { isConfigured } from './lib/supabase.js'
import { session, initSession } from './lib/session.js'
import Entrar from './views/Entrar.vue'
import Familia from './views/Familia.vue'
import NovaPalavraPasse from './views/NovaPalavraPasse.vue'

onMounted(initSession)
</script>

<template>
  <div class="shell">
    <header class="top">
      <span class="brand">🧺 Rancho</span>
      <span v-if="session.member" class="who">{{ session.member.display_name }}</span>
    </header>

    <p v-if="!isConfigured" class="notice">
      Versão de teste: a ligação à base de dados ainda não está configurada.
    </p>

    <main v-if="isConfigured && !session.ready" class="content center muted">A carregar…</main>
    <main v-else-if="isConfigured && session.recovering" class="content"><NovaPalavraPasse /></main>
    <main v-else-if="isConfigured && !session.user" class="content"><Entrar /></main>
    <main v-else-if="isConfigured && !session.household" class="content"><Familia /></main>
    <template v-else>
      <main class="content">
        <RouterView />
      </main>
      <nav class="tabs" aria-label="Navegação principal">
        <RouterLink v-for="p in pages" :key="p.name" :to="p.path" class="tab">
          <span class="tab-icon" aria-hidden="true">{{ p.icon }}</span>
          <span class="tab-label">{{ p.label }}</span>
        </RouterLink>
      </nav>
    </template>
  </div>
</template>
