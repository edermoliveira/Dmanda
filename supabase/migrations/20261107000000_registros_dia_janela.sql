-- Perfil: a janela de correção (decisão 56) também vale na escrita direta na tabela. Corrige a migração 16 sem reescrevê-la.
-- Falha corrigida: public.registrar_dias só aceita hoje e os 5 dias anteriores, mas a conta autorizada tem insert e update na tabela e, pela API de dados,
-- gravava direto qualquer dia (futuro, antigo). A regra passa a ser do banco em todos os caminhos.
-- Aditiva e sem tocar em dados: só duas políticas novas. Nenhuma linha, função, privilégio ou política existente muda.
--   * Políticas RESTRITIVAS somam-se (E lógico) à política registros_dia_dono, que continua sendo a única que concede acesso e que exige a conta autorizada
--     e o próprio usuário. Restritivas só podem tirar acesso, nunca dar; vale para o papel authenticated (anon não tem privilégio algum na tabela, e a chave de serviço
--     e o administrador do banco, que ignoram a RLS, seguem podendo reparar ou restaurar dados).
--   * Inserir: o dia da linha nova precisa estar entre hoje - 5 e hoje (public.hoje() é o dia civil de America/Sao_Paulo; o upsert de registrar_dias passa por aqui).
--   * Atualizar: a linha atual precisa estar na janela (registro mais antigo fica só para leitura) E a linha resultante também (alterar a data não leva para fora).
--     A linha fora da janela é simplesmente invisível ao update (0 linhas afetadas); o resultado que viola a janela devolve erro de política.
--   * Leitura não é restringida: o histórico continua inteiro, inclusive linhas já gravadas antes desta correção.
--   * As funções registrar_dias e listar_registros_dia não mudam (continuam SECURITY INVOKER, a RLS vale para quem chama).
--   * Os 5 dias repetem DIAS_CORRECAO de src/lib/registros.ts e o limite de registrar_dias (migração 16).
--   * Reaplicável: drop policy if exists antes de cada create.

drop policy if exists registros_dia_janela_inserir on public.registros_dia;
create policy registros_dia_janela_inserir on public.registros_dia as restrictive for insert to authenticated
  with check (dia between (select public.hoje()) - 5 and (select public.hoje()));

drop policy if exists registros_dia_janela_atualizar on public.registros_dia;
create policy registros_dia_janela_atualizar on public.registros_dia as restrictive for update to authenticated
  using (dia between (select public.hoje()) - 5 and (select public.hoje()))
  with check (dia between (select public.hoje()) - 5 and (select public.hoje()));
