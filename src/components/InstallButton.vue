<script setup>
import { ref, computed } from 'vue'
import Sheet from './Sheet.vue'
import { install, promptInstall } from '../lib/install.js'

const props = defineProps({ variant: { type: String, default: 'card' } }) // card | button
const steps = ref(null) // 'ios' | 'manual'
const hidden = ref(false)
try { hidden.value = localStorage.getItem('rancho.install.hide') === '1' } catch { /* */ }

const show = computed(() => !install.installed && (props.variant === 'button' || !hidden.value))
async function go() {
  const r = await promptInstall()
  if (r !== 'nativo') steps.value = r
}
function later() { hidden.value = true; try { localStorage.setItem('rancho.install.hide', '1') } catch { /* */ } }
</script>

<template>
  <template v-if="show">
    <div v-if="variant === 'card'" class="card install-card">
      <span class="install-icon" aria-hidden="true">📲</span>
      <div class="grow">
        <b>Instalar a app</b>
        <div class="muted small">Fica com ícone no ecrã inicial e abre como uma app.</div>
      </div>
      <div class="install-actions">
        <button class="btn primary small-btn" @click="go">Instalar</button>
        <button class="link small" @click="later">Agora não</button>
      </div>
    </div>
    <button v-else class="btn" @click="go">📲 Instalar a app no ecrã inicial</button>
  </template>

  <Sheet v-if="steps" title="Instalar no ecrã inicial" @close="steps = null">
    <ol v-if="steps === 'ios'" class="install-steps">
      <li>Abre esta página no <b>Safari</b> (no Chrome do iPhone não funciona).</li>
      <li>Toca no botão <b>Partilhar</b> <span class="share-ico">⬆︎</span> (em baixo, ao centro).</li>
      <li>Desliza e toca em <b>"Adicionar ao ecrã principal"</b>.</li>
      <li>Toca em <b>Adicionar</b>. O ícone do cesto verde aparece no ecrã inicial.</li>
    </ol>
    <ol v-else class="install-steps">
      <li>Abre o menu do navegador <b>⋮</b> (canto superior direito).</li>
      <li>Toca em <b>"Instalar app"</b> ou <b>"Adicionar ao ecrã principal"</b>.</li>
      <li>Confirma. O ícone do cesto verde aparece no ecrã inicial.</li>
    </ol>
  </Sheet>
</template>
