-- Preços ao quilo/litro calculados a partir do total pago (23 nov 2026)
-- Ex.: 1,202 kg por 295 MT = 245,4243 MT/kg. Com só 2 casas decimais (245,42) o total
-- voltava a dar 294,99 MT. Passa a guardar 4 casas decimais. Os valores atuais não mudam.
-- Correr uma vez no Supabase: SQL Editor > New query > colar > Run.
alter table public.purchases alter column price type numeric(14,4);
alter table public.list_items alter column planned_price type numeric(14,4);
