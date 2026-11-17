// Traduz as mensagens de erro mais comuns do Supabase para português
const map = [
  [/invalid login credentials/i, 'Email ou palavra-passe incorretos.'],
  [/email not confirmed/i, 'Ainda não confirmaste o email. Abre o link que recebeste.'],
  [/user already registered/i, 'Já existe uma conta com este email. Usa "Entrar".'],
  [/password should be at least/i, 'A palavra-passe deve ter pelo menos 8 caracteres.'],
  [/rate limit|too many/i, 'Demasiadas tentativas. Espera alguns minutos e tenta de novo.'],
  [/código de convite inválido/i, 'Código de convite inválido. Confirma o código com quem te convidou.'],
  [/failed to fetch|network/i, 'Sem ligação à internet. Tenta de novo.'],
  [/duplicate key|unique/i, 'Já existe um registo com esse nome.'],
]

export function friendlyError(err) {
  const msg = err?.message || String(err || '')
  for (const [re, text] of map) if (re.test(msg)) return text
  return msg || 'Ocorreu um erro inesperado.'
}
