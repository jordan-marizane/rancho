\set ON_ERROR_STOP 1
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''

-- Jordan (A) cria a família
set role authenticated;
select set_config('request.jwt.claim.sub', :A, false);
select public.create_household('Família Teste', 'Jordan') as hid \gset
select invite_code as code from households \gset

insert into stores (household_id, name, kind) values (:'hid', 'Shoprite', 'supermercado') returning id as s1 \gset
insert into stores (household_id, name, kind) values (:'hid', 'Mercearia Central', 'mercearia') returning id as s2 \gset
insert into categories (household_id, name) values (:'hid', 'Mercearia') returning id as c1 \gset
insert into products (household_id, name, category_id, unit, pack_size) values (:'hid', 'Arroz 5kg', :'c1', 'kg', 5) returning id as p1 \gset
insert into products (household_id, name, category_id) values (:'hid', 'Óleo 2L', :'c1') returning id as p2 \gset
insert into fixed_expenses (household_id, name, amount, due_day) values (:'hid', 'Renda', 25000, 5);

-- Outubro
select public.start_month(:'hid', '2026-10-15') as m10 \gset
update months set rancho_budget = 20000, total_budget = 60000 where id = :'m10';
insert into list_items (household_id, month_id, product_id, planned_qty, store_id) values (:'hid', :'m10', :'p1', 2, :'s1');
insert into list_items (household_id, month_id, product_id, planned_qty, store_id) values (:'hid', :'m10', :'p2', 1, :'s2');
insert into purchases (household_id, product_id, store_id, month_id, price, quantity, pack_size, purchased_on)
values (:'hid', :'p1', :'s1', :'m10', 650, 2, 5, '2026-10-28');

-- Esposa (B) entra com o código
select set_config('request.jwt.claim.sub', :B, false);
select public.join_household(:'code', 'Esposa');
select count(*) = 2 as b_sees_stores from stores \gset
\if :b_sees_stores \echo 'OK  esposa vê as lojas da família' \else \echo 'FALHA esposa não vê lojas' \quit \endif

-- Novembro aberto pela esposa: copia lista, orçamento e fixas
select public.start_month(:'hid', '2026-11-01') as m11 \gset
select (select count(*) from list_items where month_id = :'m11') = 2
   and (select rancho_budget from months where id = :'m11') = 20000
   and (select count(*) from month_expenses where month_id = :'m11') = 1 as copied \gset
\if :copied \echo 'OK  novo mês copia lista, orçamento e despesas fixas' \else \echo 'FALHA cópia do mês' \quit \endif
select public.start_month(:'hid', '2026-11-20') = :'m11' as idem \gset
\if :idem \echo 'OK  abrir o mesmo mês duas vezes não duplica' \else \echo 'FALHA mês duplicado' \quit \endif

-- Esposa marca renda como paga
update month_expenses set paid_at = now() where month_id = :'m11';
select paid_by = :B::uuid as paid_ok from month_expenses where month_id = :'m11' \gset
\if :paid_ok \echo 'OK  pagamento regista quem marcou' \else \echo 'FALHA paid_by' \quit \endif

-- Esposa edita a compra de Jordan: autor original mantém-se, editor fica registado
update purchases set price = 640 where product_id = :'p1';
select created_by = :A::uuid and updated_by = :B::uuid as who_ok from purchases where product_id = :'p1' \gset
\if :who_ok \echo 'OK  created_by/updated_by corretos' \else \echo 'FALHA autoria' \quit \endif
select count(*) >= 1 as audit_ok from audit_log where table_name = 'purchases' and action = 'UPDATE' and changed_by = :B::uuid \gset
\if :audit_ok \echo 'OK  histórico regista a alteração e o autor' \else \echo 'FALHA audit' \quit \endif

-- Esposa não pode tornar-se dona
\set ON_ERROR_STOP 0
update household_members set role = 'owner' where user_id = :B::uuid;
\set ON_ERROR_STOP 1
\set ON_ERROR_STOP 0
update households set invite_code = 'AAAA' where id = :'hid';
insert into audit_log (household_id, table_name, action) values (:'hid', 'x', 'INSERT');
\set ON_ERROR_STOP 1
select (select invite_code from households where id = :'hid') = :'code' as code_ok \gset
\if :code_ok \echo 'OK  membro não muda o código de convite diretamente' \else \echo 'FALHA código alterado' \quit \endif

-- Estranho (C) não vê nada e não consegue escrever
select set_config('request.jwt.claim.sub', :C, false);
select (select count(*) from stores) + (select count(*) from products) + (select count(*) from purchases)
     + (select count(*) from households) + (select count(*) from audit_log) + (select count(*) from household_members) = 0 as isolated \gset
\if :isolated \echo 'OK  outra conta não vê nenhum dado da família' \else \echo 'FALHA isolamento' \quit \endif
\set ON_ERROR_STOP 0
insert into stores (household_id, name) values (:'hid', 'Intrusa');
select public.start_month(:'hid', '2026-12-01');
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub', :A, false);
select count(*) = 2 as no_intrusion from stores \gset
\if :no_intrusion \echo 'OK  outra conta não consegue escrever na família' \else \echo 'FALHA escrita indevida' \quit \endif
select role = 'member' as role_ok from household_members where user_id = :B::uuid \gset
\if :role_ok \echo 'OK  membro não consegue mudar o próprio papel' \else \echo 'FALHA papel alterado' \quit \endif

-- Anónimo não acede a nada
reset role; set role anon;
\set ON_ERROR_STOP 0
select count(*) from stores;
\set ON_ERROR_STOP 1
select public.ping();
\echo 'FIM dos testes'
