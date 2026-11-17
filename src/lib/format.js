const nf = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export const mt = (v) => (v == null ? '—' : `${nf.format(Number(v))} MT`)

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
