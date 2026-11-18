import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { router } from './router.js'
import './lib/install.js' // começa a ouvir o pedido de instalação o mais cedo possível

createApp(App).use(router).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
