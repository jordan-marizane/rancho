// Deteta uma versão nova da app publicada (o ficheiro principal muda de nome a cada versão)
// e mostra o aviso "Nova versão": um toque recarrega. Verifica ao voltar à app e a cada 5 minutos.
import { reactive } from 'vue'

export const appUpdate = reactive({ available: false })

const current = () => document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src')

async function check() {
  const mine = current()
  if (!mine || appUpdate.available) return
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })
    const html = await res.text()
    const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0]
    if (latest && latest !== mine) appUpdate.available = true
  } catch { /* sem rede */ }
}

export function startUpdateCheck() {
  if (!import.meta.env.PROD) return
  setInterval(check, 5 * 60 * 1000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  setTimeout(check, 10000)
}

export const reloadApp = () => window.location.reload()
