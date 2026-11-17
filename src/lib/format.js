// 20470.5 -> "20 470,50 MT" (espaço nos milhares, vírgula nos decimais)
export const mt = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const n = Math.round(Number(v) * 100) / 100
  const [int, dec] = Math.abs(n).toFixed(2).split('.')
  const s = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (dec === '00' ? '' : `,${dec}`)
  return `${n < 0 ? '−' : ''}${s} MT`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
// d no formato AAAA-MM-DD
export const monthLabel = (d) => `${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`
export const dayLabel = (d) => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Para pesquisar sem se preocupar com acentos nem maiúsculas
export const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
