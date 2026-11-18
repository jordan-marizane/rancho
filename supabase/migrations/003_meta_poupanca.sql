-- Meta de poupança do rancho por mês (2026-11-18)
alter table public.months add column if not exists savings_goal numeric(12,2) check (savings_goal >= 0);
