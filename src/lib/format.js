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

// Quantidade com a unidade do produto: 1.202 kg -> "1,202 kg"; 3 un -> "3"
export const qtyLabel = (q, unit = 'un') => {
  const s = String(Math.round(Number(q) * 1000) / 1000).replace('.', ',')
  return unit === 'kg' ? `${s} kg` : unit === 'L' ? `${s} L` : unit === 'monte' ? `${s} monte${Number(q) === 1 ? '' : 's'}` : s
}
// Sufixo do preço unitário: "/kg", "/L", "" (unidade)
export const perUnit = (unit = 'un') => (unit === 'kg' ? '/kg' : unit === 'L' ? '/L' : unit === 'monte' ? '/monte' : '')
// "1,202" ou "1.202" -> 1.202
export const parseNum = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
