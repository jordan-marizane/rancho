<script setup>
// Painel que sobe do fundo do ecrã (no computador, aparece ao centro)
import { onMounted, onBeforeUnmount } from 'vue'
const emit = defineEmits(['close'])
defineProps({ title: String })
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => { document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden' })
onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>

<template>
  <div class="sheet-backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-modal="true" :aria-label="title">
      <header class="sheet-head">
        <h2>{{ title }}</h2>
        <button class="icon-btn" aria-label="Fechar" @click="emit('close')">✕</button>
      </header>
      <div class="sheet-body"><slot /></div>
    </div>
  </div>
</template>
