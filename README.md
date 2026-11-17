# Rancho

Web App para a família gerir as despesas do mês e comparar os preços do rancho
com os meses anteriores. Funciona no telemóvel (Android e iPhone), tablet e computador.

## Tecnologias (todas gratuitas)

| Peça | Ferramenta |
|---|---|
| Ecrãs | Vue 3 + Vite, instalável como app (PWA) |
| Dados, contas e histórico | Supabase (PostgreSQL) |
| Alojamento | Cloudflare Pages |
| Código e cópia de segurança do código | GitHub (repositório privado) |

## Estrutura

```
src/              código da app (páginas em src/views)
public/           ícones, manifest e service worker (PWA)
supabase/schema.sql      base de dados, regras de segurança e histórico
supabase/tests/          testes do esquema (PostgreSQL local)
.github/workflows/       "toque" diário para o Supabase não pausar
```

## Correr no computador

```bash
npm install
cp .env.example .env.local   # preencher com os dados do Supabase
npm run dev
```

## Testar a base de dados localmente

Com PostgreSQL 15+ instalado:

```bash
createdb rancho_test
psql -d rancho_test -f supabase/tests/supabase_stub.sql
psql -d rancho_test -f supabase/schema.sql
psql -d rancho_test -f supabase/tests/test_schema.sql
```

Cada linha deve começar por `OK`.

## Publicar (Cloudflare Pages)

- Build command: `npm run build`
- Output directory: `dist`
- Variáveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Cada `git push` para `main` publica uma nova versão automaticamente.
