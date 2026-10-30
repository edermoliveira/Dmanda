-- Entradas: cinco cores pastel (a sexta foi retirada em 30/10/2026). Só o sorteio da cor automática muda: passa a escolher entre 0 e 4.
-- Aditiva e compatível: nenhuma anotação é alterada, apagada ou recriada. As que já usam a cor 5 (a retirada) continuam válidas, visíveis, editáveis, recuperáveis e nas cópias;
-- só deixam de ser oferecidas na escolha e no sorteio. A restrição da tabela (0 a 5) não muda, por isso cópias anteriores continuam restauráveis.
-- A função é a mesma da migração 10 (a 10 não é reescrita): create or replace mantém os privilégios já concedidos.
create or replace function public.cor_entrada_automatica() returns smallint language sql volatile set search_path = '' as $$
  with uso as (
    select c::smallint as cor, (select count(*) from public.entradas e where e.cor = c and e.arquivada_em is null and e.demanda_id is null) as n from generate_series(0, 4) c
  )
  select cor from uso where n = (select min(n) from uso) order by random() limit 1
$$;
