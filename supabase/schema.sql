-- =====================================================================
-- Rancho: esquema da base de dados (Supabase / PostgreSQL)
-- Executar uma vez no "SQL Editor" do Supabase.
--
-- Princípios:
--   * Todos os dados pertencem a uma "família" (household).
--   * Só os membros da família podem ver ou alterar os dados dela (RLS).
--   * Cada alteração fica registada em audit_log (quem, quando, o quê).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

create table public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 80),
  invite_code  text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  currency     text not null default 'MZN',
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null default auth.uid(),
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

create table public.stores (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  kind         text not null default 'supermercado'
               check (kind in ('supermercado', 'mercearia', 'mercado', 'outro')),
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid()
);
create unique index stores_name_uq on public.stores (household_id, lower(trim(name)));

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 60),
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid()
);
create unique index categories_name_uq on public.categories (household_id, lower(trim(name)));

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 100),
  category_id  uuid references public.categories(id) on delete set null,
  -- unidade de comparação de preço: un, kg, L ou monte
  unit         text not null default 'un' check (unit in ('un', 'kg', 'L', 'monte')),
  -- tamanho habitual da embalagem na unidade acima (ex.: 5 para arroz de 5 kg)
  pack_size    numeric(10,3) not null default 1 check (pack_size > 0),
  default_qty  numeric(10,3) not null default 1 check (default_qty > 0),
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid()
);
create unique index products_name_uq on public.products (household_id, lower(trim(name)));

-- Um registo por mês (ano-mês guardado como o dia 1 desse mês)
create table public.months (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  month         date not null check (extract(day from month) = 1),
  rancho_budget numeric(12,2) check (rancho_budget >= 0),
  total_budget  numeric(12,2) check (total_budget >= 0),
  savings_goal  numeric(12,2) check (savings_goal >= 0),
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid default auth.uid(),
  unique (household_id, month)
);

-- Lista do rancho de um mês
create table public.list_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_id     uuid not null references public.months(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  planned_qty  numeric(10,3) not null default 1 check (planned_qty > 0),
  store_id     uuid references public.stores(id) on delete set null,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid(),
  unique (month_id, product_id)
);

-- Cada preço registado (na loja ou em casa a partir do talão)
create table public.purchases (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  store_id     uuid references public.stores(id) on delete set null,
  month_id     uuid references public.months(id) on delete set null,
  -- preço de UMA embalagem/unidade
  price        numeric(12,2) not null check (price >= 0),
  quantity     numeric(10,3) not null default 1 check (quantity > 0),
  pack_size    numeric(10,3) not null default 1 check (pack_size > 0),
  purchased_on date not null default current_date,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid()
);
create index on public.purchases (household_id, product_id, purchased_on desc);

-- Modelo das despesas fixas (repetem-se todos os meses)
create table public.fixed_expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  amount       numeric(12,2) not null check (amount >= 0),
  due_day      int check (due_day between 1 and 31),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid()
);

-- Despesas fixas de um mês concreto (cópia do modelo, marcada como paga)
create table public.month_expenses (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households(id) on delete cascade,
  month_id         uuid not null references public.months(id) on delete cascade,
  fixed_expense_id uuid references public.fixed_expenses(id) on delete set null,
  name             text not null check (length(trim(name)) between 1 and 80),
  amount           numeric(12,2) not null check (amount >= 0),
  due_day          int check (due_day between 1 and 31),
  paid_at          timestamptz,
  paid_by          uuid,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid default auth.uid()
);

-- Histórico de alterações: quem fez o quê
create table public.audit_log (
  id           bigint generated always as identity primary key,
  household_id uuid not null,
  table_name   text not null,
  row_id       uuid,
  action       text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data     jsonb,
  new_data     jsonb,
  changed_by   uuid default auth.uid(),
  changed_at   timestamptz not null default now()
);
create index on public.audit_log (household_id, changed_at desc);

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

-- O utilizador atual pertence a esta família?
create or replace function public.is_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- Preenche updated_at / updated_by e impede trocar de família
create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if new.household_id <> old.household_id then
    raise exception 'Não é permitido mudar o registo de família';
  end if;
  return new;
end;
$$;

-- Garante que created_by é sempre o utilizador real
create or replace function public.stamp_creator()
returns trigger
language plpgsql
as $$
begin
  new.created_by := auth.uid();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- Escreve no histórico
create or replace function public.write_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (household_id, table_name, row_id, action, old_data, new_data, changed_by)
  values (
    (rec->>'household_id')::uuid,
    tg_table_name,
    (rec->>'id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['stores', 'categories', 'products', 'months', 'list_items',
                           'purchases', 'fixed_expenses', 'month_expenses']
  loop
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.touch_row()', t, t);
    execute format('create trigger %I_stamp before insert on public.%I
                    for each row execute function public.stamp_creator()', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I
                    for each row execute function public.write_audit()', t, t);
  end loop;
end $$;

-- Ao marcar uma despesa como paga, regista quem pagou
create or replace function public.stamp_paid()
returns trigger
language plpgsql
as $$
begin
  if new.paid_at is not null and (old.paid_at is null) then
    new.paid_by := auth.uid();
  elsif new.paid_at is null then
    new.paid_by := null;
  end if;
  return new;
end;
$$;
create trigger month_expenses_paid before update on public.month_expenses
  for each row execute function public.stamp_paid();

-- ---------------------------------------------------------------------
-- Ações (RPC) chamadas pela app
-- ---------------------------------------------------------------------

-- Criar uma família nova; quem cria fica como "owner"
create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  insert into households (name, created_by) values (trim(p_name), auth.uid()) returning id into hid;
  insert into household_members (household_id, user_id, display_name, role)
  values (hid, auth.uid(), trim(p_display_name), 'owner');
  return hid;
end;
$$;

-- Entrar numa família com o código de convite
create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'Código de convite inválido'; end if;
  insert into household_members (household_id, user_id, display_name, role)
  values (hid, auth.uid(), trim(p_display_name), 'member')
  on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  return hid;
end;
$$;

-- Gerar novo código de convite (só o dono), ex. depois de convidar quem queria
create or replace function public.rotate_invite_code(hid uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare code text;
begin
  if not exists (select 1 from household_members
                 where household_id = hid and user_id = auth.uid() and role = 'owner') then
    raise exception 'Só o dono da família pode mudar o código';
  end if;
  update households set invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 8))
  where id = hid returning invite_code into code;
  return code;
end;
$$;

-- Abrir um mês: cria-o e copia a lista do rancho, o orçamento e as despesas fixas
-- do mês anterior mais recente. Se o mês já existir, devolve-o sem alterar nada.
create or replace function public.start_month(hid uuid, p_month date)
returns uuid
language plpgsql
as $$
declare
  m_id   uuid;
  prev   public.months%rowtype;
  first_day date := date_trunc('month', p_month)::date;
begin
  if not public.is_member(hid) then raise exception 'Sem acesso a esta família'; end if;

  select id into m_id from public.months where household_id = hid and month = first_day;
  if m_id is not null then return m_id; end if;

  select * into prev from public.months
  where household_id = hid and month < first_day
  order by month desc limit 1;

  insert into public.months (household_id, month, rancho_budget, total_budget)
  values (hid, first_day, prev.rancho_budget, prev.total_budget)
  returning id into m_id;

  if prev.id is not null then
    insert into public.list_items (household_id, month_id, product_id, planned_qty, store_id)
    select hid, m_id, li.product_id, li.planned_qty, li.store_id
    from public.list_items li
    join public.products p on p.id = li.product_id and not p.archived
    where li.month_id = prev.id;
  end if;

  insert into public.month_expenses (household_id, month_id, fixed_expense_id, name, amount, due_day)
  select hid, m_id, fe.id, fe.name, fe.amount, fe.due_day
  from public.fixed_expenses fe
  where fe.household_id = hid and fe.active;

  return m_id;
end;
$$;

-- Usado pelo "toque" diário que impede o Supabase gratuito de pausar
create or replace function public.ping()
returns text language sql stable as $$ select 'ok'::text $$;

-- ---------------------------------------------------------------------
-- Segurança: Row Level Security
-- ---------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.stores            enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.months            enable row level security;
alter table public.list_items        enable row level security;
alter table public.purchases         enable row level security;
alter table public.fixed_expenses    enable row level security;
alter table public.month_expenses    enable row level security;
alter table public.audit_log         enable row level security;

-- Famílias: ver e renomear só a sua. Criar só através de create_household().
create policy households_select on public.households
  for select to authenticated using (public.is_member(id));
create policy households_update on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

-- Membros: ver os colegas de família; mudar só o próprio nome.
create policy members_select on public.household_members
  for select to authenticated using (public.is_member(household_id));
create policy members_update_self on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_leave on public.household_members
  for delete to authenticated using (user_id = auth.uid());

-- Dados da família: membros podem ler e escrever
do $$
declare t text;
begin
  foreach t in array array['stores', 'categories', 'products', 'months', 'list_items',
                           'purchases', 'fixed_expenses', 'month_expenses']
  loop
    execute format('create policy %I_all on public.%I for all to authenticated
                    using (public.is_member(household_id))
                    with check (public.is_member(household_id))', t, t);
  end loop;
end $$;

-- Histórico: só leitura (escrito apenas pelos triggers)
create policy audit_select on public.audit_log
  for select to authenticated using (public.is_member(household_id));

-- Permissões: anónimos não têm acesso a nada
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on function public.ping() to anon, authenticated;
grant execute on function public.create_household(text, text),
                          public.join_household(text, text),
                          public.rotate_invite_code(uuid),
                          public.start_month(uuid, date),
                          public.is_member(uuid) to authenticated;
grant select, insert, update, delete on
  public.stores, public.categories, public.products, public.months, public.list_items,
  public.purchases, public.fixed_expenses, public.month_expenses to authenticated;
-- O Supabase dá todas as permissões ao "authenticated" por omissão: retirar o que não deve ser possível
revoke insert, update on public.households, public.household_members from authenticated;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke truncate on all tables in schema public from authenticated;
grant select, update (name) on public.households to authenticated;
grant select, delete, update (display_name) on public.household_members to authenticated;
grant select on public.audit_log to authenticated;
