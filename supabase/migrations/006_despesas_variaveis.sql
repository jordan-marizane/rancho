-- Despesas variáveis (18 nov 2026)
-- 1) Contas que se repetem mas mudam de valor (água, energia): marcadas como "valor varia"
-- 2) Despesas que aparecem durante o mês (farmácia, reparações, recargas Credelec…)
-- 3) Reserva para imprevistos no orçamento do mês
-- Correr uma vez no Supabase: SQL Editor > New query > colar > Run.

alter table public.fixed_expenses add column if not exists variable boolean not null default false;
alter table public.months add column if not exists reserve_budget numeric(12,2) check (reserve_budget >= 0);

create table if not exists public.extra_expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_id     uuid not null references public.months(id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  amount       numeric(12,2) not null check (amount > 0),
  category     text not null default 'outros'
               check (category in ('energia', 'casa', 'saude', 'transporte', 'criancas', 'ofertas', 'outros')),
  spent_on     date not null default current_date,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid()
);
create index if not exists extra_expenses_month on public.extra_expenses (month_id);

drop trigger if exists extra_expenses_touch on public.extra_expenses;
drop trigger if exists extra_expenses_stamp on public.extra_expenses;
drop trigger if exists extra_expenses_audit on public.extra_expenses;
create trigger extra_expenses_touch before update on public.extra_expenses
  for each row execute function public.touch_row();
create trigger extra_expenses_stamp before insert on public.extra_expenses
  for each row execute function public.stamp_creator();
create trigger extra_expenses_audit after insert or update or delete on public.extra_expenses
  for each row execute function public.write_audit();

alter table public.extra_expenses enable row level security;
drop policy if exists extra_expenses_all on public.extra_expenses;
create policy extra_expenses_all on public.extra_expenses for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

revoke all on public.extra_expenses from anon;
revoke truncate on public.extra_expenses from authenticated;
grant select, insert, update, delete on public.extra_expenses to authenticated;
