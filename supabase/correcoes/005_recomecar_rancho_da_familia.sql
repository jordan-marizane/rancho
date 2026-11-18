-- Apaga os dados do RANCHO de uma família (lista de teste), para importar a lista de outubro.
-- Mantém: a família, os membros, o código de convite e as despesas fixas que já criaram.
-- Apaga: lojas, categorias, produtos, preços, meses (orçamentos e pagamentos marcados).
--
-- ANTES DE CORRER: troquem O_VOSSO_EMAIL pelo email com que entram na app (fica só no vosso Supabase).
-- Não tem volta. Corram no Supabase: SQL Editor > New query > colar > Run.

do $$
declare
  fam uuid[];
  n_prod int;
begin
  select array_agg(m.household_id) into fam
  from public.household_members m join auth.users u on u.id = m.user_id
  where u.email = 'O_VOSSO_EMAIL';
  if fam is null then
    raise exception 'Nenhuma família com esse email: troquem O_VOSSO_EMAIL pelo vosso email. Nada foi apagado.';
  end if;
  delete from public.purchases  where household_id = any(fam);
  delete from public.months     where household_id = any(fam);  -- apaga também listas e pagamentos marcados
  delete from public.products   where household_id = any(fam);
  get diagnostics n_prod = row_count;
  delete from public.categories where household_id = any(fam);
  delete from public.stores     where household_id = any(fam);
  raise notice 'Feito: % produtos apagados. Já podem importar a lista de outubro.', n_prod;
end $$;
