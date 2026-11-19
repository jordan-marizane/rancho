import { catalog, priceStats, storeName } from './catalog.js'
import { rancho, boughtThisMonth, lastBefore, activeItems } from './rancho.js'
import { mt } from './format.js'

// Sugestões de poupança a partir dos vossos dados (não conselhos genéricos).
// Só olha para os produtos da lista deste mês que ainda não foram comprados.
export function savingTips(prevMonthId) {
  const tips = []
  for (const it of activeItems()) {
    if (it.done || boughtThisMonth(it.product_id).length) continue
    const product = catalog.products.find((p) => p.id === it.product_id)
    if (!product) continue
    const qty = Number(it.planned_qty) || 1
    const ref = lastBefore(it.product_id)
    if (!ref) continue

    // 1) Outra loja foi mais barata nos últimos 6 meses
    const { cheapest, history } = priceStats(it.product_id)
    if (cheapest && cheapest.store_id !== ref.store_id && Number(cheapest.price) < Number(ref.price)) {
      const value = (Number(ref.price) - Number(cheapest.price)) * qty
      if (value >= 10) {
        tips.push({ kind: 'loja', value, icon: '🏪',
          text: `${product.name}: ${mt(cheapest.price)} em ${storeName(cheapest.store_id)} vs ${mt(ref.price)} em ${storeName(ref.store_id)}` })
        continue
      }
    }
    // 2) Subiu muito da última vez: vale a pena comparar
    const before = history.find((p) => p.purchased_on < ref.purchased_on)
    if (before) {
      const diff = Number(ref.price) - Number(before.price)
      const pct = diff / Number(before.price)
      if (diff >= 20 && pct >= 0.15) {
        tips.push({ kind: 'subida', value: diff * qty, icon: '📈',
          text: `${product.name} subiu ${Math.round(pct * 100)}% (${mt(before.price)} → ${mt(ref.price)}): comparem noutra loja ou marca` })
        continue
      }
    }
    // 3) Estava na lista do mês passado mas não foi comprado: será preciso?
    if (prevMonthId && !catalog.purchases.some((p) => p.month_id === prevMonthId && p.product_id === it.product_id)) {
      tips.push({ kind: 'dispensavel', value: Number(ref.price) * qty, icon: '🤔',
        text: `${product.name} (${mt(Number(ref.price) * qty)}) não foi comprado no mês passado: é mesmo preciso?` })
    }
  }
  return tips.sort((a, b) => b.value - a.value)
}
