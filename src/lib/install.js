import { reactive } from 'vue'

// Instalação da app no ecrã inicial.
// Android/Chrome: usa o pedido nativo (beforeinstallprompt).
// iPhone/Safari: não existe pedido nativo, por isso mostramos os passos.
export const install = reactive({
  deferred: null,
  installed: false,
  ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
})

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
install.installed = standalone()

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.deferred = e })
window.addEventListener('appinstalled', () => { install.installed = true; install.deferred = null })

export const canOffer = () => !install.installed && (install.deferred || install.ios)

// Devolve 'nativo' se o sistema mostrou o pedido, 'ios' se é preciso mostrar os passos
export async function promptInstall() {
  if (install.deferred) {
    install.deferred.prompt()
    const { outcome } = await install.deferred.userChoice
    install.deferred = null
    if (outcome === 'accepted') install.installed = true
    return 'nativo'
  }
  return install.ios ? 'ios' : 'manual'
}
