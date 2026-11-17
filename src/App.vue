<script setup>
import { pages } from './router.js'
import { isConfigured } from './lib/supabase.js'
</script>

<template>
  <div class="shell">
    <header class="top">
      <span class="brand">🧺 Rancho</span>
    </header>

    <p v-if="!isConfigured" class="notice">
      Versão de teste: a ligação à base de dados ainda não está configurada.
    </p>

    <main class="content">
      <RouterView />
    </main>

    <nav class="tabs" aria-label="Navegação principal">
      <RouterLink v-for="p in pages" :key="p.name" :to="p.path" class="tab">
        <span class="tab-icon" aria-hidden="true">{{ p.icon }}</span>
        <span class="tab-label">{{ p.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
