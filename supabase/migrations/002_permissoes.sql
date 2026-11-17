-- Correção de permissões (2026-11-18)
-- O Supabase dá, por omissão, todas as permissões nas tabelas ao papel "authenticated".
-- Aqui retiramos o que não deve ser possível a partir da app:
--   * um membro não pode mudar o próprio papel (ex.: tornar-se "dono");
--   * o código de convite só muda pela função rotate_invite_code();
--   * famílias e membros só se criam pelas funções create_household() / join_household();
--   * o histórico (audit_log) é só de leitura.
revoke insert, update on public.households from authenticated;
grant update (name) on public.households to authenticated;

revoke insert, update on public.household_members from authenticated;
grant update (display_name) on public.household_members to authenticated;

revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke truncate on all tables in schema public from authenticated;
