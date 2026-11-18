-- Correção (18 nov 2026): a lista importada ficou um mês à frente.
-- O rancho é feito entre os dias 20 e 30 de cada mês, por isso os preços importados
-- são de SETEMBRO (antes da "/") e OUTUBRO (depois da "/"), e não de outubro e novembro.
-- Este script recua um mês os dados da importação (compras com data no dia 1 de
-- outubro/novembro de 2026 e os meses correspondentes). Novembro fica livre para
-- começar o rancho de novembro na app, já com a escolha de produtos.
-- Só é preciso correr UMA vez, e só se já importaram a lista.
begin;

-- 1) Compras importadas
update public.purchases set purchased_on = '2026-09-01' where purchased_on = '2026-10-01';
update public.purchases set purchased_on = '2026-10-01' where purchased_on = '2026-11-01';

-- 2) Meses (primeiro outubro -> setembro, depois novembro -> outubro)
update public.months m set month = '2026-09-01'
where month = '2026-10-01'
  and not exists (select 1 from public.months x where x.household_id = m.household_id and x.month = '2026-09-01');
update public.months m set month = '2026-10-01'
where month = '2026-11-01'
  and not exists (select 1 from public.months x where x.household_id = m.household_id and x.month = '2026-10-01');

commit;

-- Verificação: deve mostrar setembro e outubro, e nenhum novembro
select h.name, m.month, (select count(*) from public.list_items li where li.month_id = m.id) as produtos_na_lista
from public.months m join public.households h on h.id = m.household_id
where h.name not like 'Família Teste%'
order by h.name, m.month;
