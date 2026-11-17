<script setup>
import { mt } from '../lib/format.js'
defineProps({ diff: { type: Number, default: null } })
</script>

<template>
  <span v-if="diff == null" class="trend none">—</span>
  <span v-else-if="Math.abs(diff) < 0.005" class="trend same" title="Igual ao anterior">= igual</span>
  <span v-else-if="diff > 0" class="trend up" title="Mais caro que da vez anterior">▲ {{ mt(diff) }}</span>
  <span v-else class="trend down" title="Mais barato que da vez anterior">▼ {{ mt(-diff) }}</span>
</template>
