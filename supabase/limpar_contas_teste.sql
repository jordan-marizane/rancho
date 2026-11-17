-- Apaga as contas e famílias de teste criadas durante o desenvolvimento
-- (emails teste.rancho.*@example.com). Pode ser executado mais do que uma vez.
delete from public.households h
where exists (
  select 1 from auth.users u
  where u.id = h.created_by and u.email like 'teste.rancho.%@example.com'
);
delete from auth.users where email like 'teste.rancho.%@example.com';
