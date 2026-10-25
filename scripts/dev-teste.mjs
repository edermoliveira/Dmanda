// Sobe o aplicativo na porta 7100 com o banco local de TESTE (descartável, em .dados-teste/). Só para desenvolvimento e testes: não é o Supabase.
import { spawn } from 'node:child_process';
const porta = process.env.PORT || '7100';
const filho = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', porta], { stdio: 'inherit', env: { ...process.env, DMANDA_BANCO: 'teste' } });
filho.on('exit', (c) => process.exit(c ?? 0));
