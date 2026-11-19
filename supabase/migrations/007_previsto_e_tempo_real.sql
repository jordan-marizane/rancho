-- Planear em casa e tempo real (19 nov 2026)
-- 1) Preço previsto em cada produto da lista do rancho (sem o marcar como comprado)
-- 2) Atualização em tempo real entre telemóveis (Supabase Realtime, plano gratuito)
-- Correr uma vez no Supabase: SQL Editor > New query > colar > Run. Pode ser repetido.

alter table public.list_items add column if not exists planned_price numeric(12,2) check (planned_price >= 0);

-- Avisar os telemóveis quando estas tabelas mudam (as regras de segurança continuam a aplicar-se:
-- cada pessoa só recebe alterações da sua família)
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['list_items', 'purchases', 'months', 'products', 'stores', 'categories',
                           'fixed_expenses', 'month_expenses', 'extra_expenses']
  loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
