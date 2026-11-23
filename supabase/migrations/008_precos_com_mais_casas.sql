-- Compras ao quilo/litro (23 nov 2026)
-- 1) Preços com 4 casas decimais: 1,202 kg por 295 MT = 245,4243 MT/kg. Com só 2 casas (245,42)
--    o total voltava a dar 294,99 MT. Os valores atuais não mudam.
-- 2) Cada compra guarda a unidade (un, kg, L), para não comparar preço por kg com preço por unidade.
-- Correr uma vez no Supabase: SQL Editor > New query > colar > Run. Pode ser repetido.
alter table public.purchases alter column price type numeric(14,4);
alter table public.list_items alter column planned_price type numeric(14,4);
alter table public.purchases add column if not exists unit text check (unit in ('un', 'kg', 'L', 'monte'));
