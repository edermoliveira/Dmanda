-- Perfil: o UPDATE direto em public.registros_dia passa a valer só para humor e energia. Corrige as migrações 16 e 17 sem reescrevê-las.
-- Falha corrigida: com UPDATE de tabela inteira, a conta autorizada podia mover a linha entre dois dias válidos da janela
-- (update ... set dia = <outro dia> where dia = <hoje>), o que tirava o registro do dia original. A política restritiva da migração 17
-- só confere se os dois dias estão na janela, então não impedia isso.
-- Aditiva e sem tocar em dados: só privilégios de coluna. Nenhuma linha, função, política ou SELECT/INSERT muda.
--   * Sai o UPDATE de tabela de authenticated; entra UPDATE somente em (humor, energia). O gatilho de atualizado_em não precisa de privilégio de coluna.
--   * registrar_dias (SECURITY INVOKER) só atualiza humor e energia no on conflict do update, então segue funcionando, inclusive na segunda gravação do dia.
--   * user_id, dia e criado_em deixam de ser alteráveis pela API de dados (a chave de serviço e o administrador do banco seguem podendo reparar dados).
--   * Reaplicável: revoke e grant são idempotentes.
revoke update on public.registros_dia from authenticated;
grant update (humor, energia) on public.registros_dia to authenticated;
