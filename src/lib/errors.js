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
  [/savings_goal/i, 'Falta atualizar a base de dados: corram o ficheiro 003_meta_poupanca.sql no Supabase.'],
  [/extra_expenses|reserve_budget|column .*variable/i, 'Falta atualizar a base de dados: corram o ficheiro 006_despesas_variaveis.sql no Supabase.'],
  [/planned_price/i, 'Falta atualizar a base de dados: corram o ficheiro 007_previsto_e_tempo_real.sql no Supabase.'],
  [/numeric field overflow/i, 'Valor demasiado grande.'],
]

export function friendlyError(err) {
  const msg = err?.message || String(err || '')
  for (const [re, text] of map) if (re.test(msg)) return text
  return msg || 'Ocorreu um erro inesperado.'
}
