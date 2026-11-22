// Sobe o aplicativo na porta 7100 com o banco local de TESTE (descartável, em .dados-teste/). Só para desenvolvimento e testes: não é o Supabase. Não há tela de entrada aqui: a identidade é a conta de teste
// (DMANDA_USUARIO_TESTE, autorizada e não administradora; use o cookie dmanda-teste-usuario com o id da conta administradora de teste para ver Usuários e acesso).
import { spawn } from 'node:child_process';
const porta = process.env.PORT || '7100';
const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', porta], { stdio: 'inherit', env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_USUARIO_TESTE: process.env.DMANDA_USUARIO_TESTE || '00000000-0000-4000-8000-000000000001' } });
filho.on('exit', (c) => process.exit(c ?? 0));
