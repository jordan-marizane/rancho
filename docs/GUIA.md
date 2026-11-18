# Rancho: guia de manutenção

Endereço da app: https://rancho.jordanmarizane.workers.dev

## 1. Testes finais (18 nov 2026)

| O quê | Resultado |
|---|---|
| Todas as páginas em iPhone SE, Android (Pixel 7), iPhone escuro, iPad e computador | Sem erros e sem deslocação lateral |
| Fluxo completo: conta, família, convite, importação, começar mês, preços, despesas fixas, resumo, exportação CSV, metas | OK contra o Supabase real |
| Acesso sem sessão (alguém com o endereço e a chave pública) | Bloqueado em todas as tabelas |
| Um membro mudar o seu papel, apagar o histórico ou criar famílias por fora da app | Bloqueado |
| Ver dados de outra família | Bloqueado: cada conta só vê a sua família |
| Dependências (`npm audit`) | 0 vulnerabilidades |

## 2. Problemas encontrados e soluções

| Problema | Solução |
|---|---|
| A pesquisa não filtrava enquanto se escrevia no telemóvel | Corrigido: filtra a cada letra |
| As permissões por defeito do Supabase deixavam um membro mudar o próprio papel | Corrigido (migração `002_permissoes.sql`, já ativa) |
| As datas e os números apareciam mal formatados em alguns telemóveis | Corrigido: formato próprio "20 470 MT" e "nov 2026" |
| Os preços de "outra loja" da lista contavam como gasto | Corrigido: ficam só como referência de preço |
| O Resumo podia aparecer vazio por 1 a 2 segundos | Agora mostra "A carregar…" |
| Os nomes do menu de baixo tinham letra pequena demais | Aumentados para o mínimo legível |
| O botão "mudar" do limite era difícil de tocar | Área de toque aumentada |
| O rancho é feito entre os dias 20 e 30 | As datas da importação foram ajustadas, e novembro fica livre para uso real |
| Leite "por caixa" e "por unidade" misturados geravam dicas erradas | Na lista nova, cada embalagem diferente deve ser um produto diferente (ex.: "Leite (caixa 12)" e "Leite (unidade)") |

## 3. Limitações conhecidas (aceites no MVP)

- **Precisa de rede**: sem dados móveis, a app não guarda preços.
- **Só meticais**: os rands ficam para uma próxima versão.
- **O preço é por unidade** (kg, L, un, monte). Comparem sempre a mesma embalagem.
- **No iPhone, instala-se só pelo Safari**: Partilhar → "Adicionar ao ecrã principal".
- **Sem lembretes ou notificações**: ficam para uma próxima versão.

## 4. Atualizar a app

Cada alteração enviada para o ramo `main` no GitHub é publicada sozinha pelo Cloudflare em 1 a 2 minutos. Para ver a versão nova no telemóvel, fechem e voltem a abrir a app.

Para voltar a uma versão anterior: Cloudflare → Workers → **rancho** → **Deployments** → escolher a versão anterior → **Rollback**.

Alterações à base de dados vêm sempre como um ficheiro `.sql` em `supabase/migrations/`. Para as aplicar, abram o ficheiro e corram-no no Supabase em **SQL Editor**, uma vez só.

## 5. Cópias de segurança

O plano gratuito do Supabase não dá cópias que possam descarregar. Por isso, façam isto uma vez por mês, depois do rancho:

1. Abram **Definições** → **⬇️ Todas as compras e preços** e **⬇️ Despesas fixas de todos os meses**.
2. Guardem os dois ficheiros CSV no Google Drive ou no email. Abrem no Excel ou no Google Sheets.

O código está no GitHub e não precisa de cópia.

## 6. Limites gratuitos (custo: 0 MT)

| Serviço | Limite | O vosso uso |
|---|---|---|
| Supabase | 500 MB de base de dados; o projeto pausa se ficar 7 dias sem uso | Alguns MB por ano. A pausa é evitada por um toque diário automático (GitHub Actions, "Manter Supabase ativo") |
| Cloudflare Workers | 100 000 pedidos por dia | Muito abaixo disso |
| GitHub Actions | 2 000 minutos por mês em repositório privado | Cerca de 5 minutos por mês |

Se mesmo assim o Supabase pausar, a app mostra um erro de ligação. Para a reativar: Supabase → projeto → **Restore project**. Os dados não se perdem.

## 7. Segurança

- A chave **publishable** é pública por natureza e está no código. A proteção dos dados está nas regras da base de dados.
- **Nunca** partilhem a chave **secret / service_role** nem a password da base de dados, com ninguém, incluindo comigo.
- Cada pessoa usa a sua própria conta. Se o link de convite for parar a quem não devia: **Definições** → **Gerar novo código**. O código antigo deixa de funcionar. (Ainda não há botão para remover um membro. Se for preciso, peçam-me.)
- Se alguém se esquecer da palavra-passe: no ecrã de entrada, "Esqueci a palavra-passe".

## 8. Tarefas pendentes do vosso lado

1. Correr `supabase/limpar_contas_teste.sql` no SQL Editor. Apaga as contas de teste (`teste.rancho.…@example.com`) que criei durante os testes.
2. Enviar a lista de outubro para importação.
