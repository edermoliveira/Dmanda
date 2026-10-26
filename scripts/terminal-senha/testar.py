"""Roda scripts/definir-senha.mjs dentro de um console de verdade (ConPTY do Windows) com teclas fictícias.
Uso: npm run testar:senha-terminal (só Windows 10 1809 ou mais novo, com Python 3; sem dependências). Nunca usa a conta real: o Auth é falso e local."""
import ctypes, ctypes.wintypes as wt, os, re, shutil, subprocess, sys, threading, time, json, tempfile

sys.stdout.reconfigure(encoding="utf-8")

k = ctypes.WinDLL('kernel32', use_last_error=True)
H = ctypes.c_void_p


class COORD(ctypes.Structure):
    _fields_ = [('X', ctypes.c_short), ('Y', ctypes.c_short)]


class STARTUPINFOW(ctypes.Structure):
    _fields_ = [('cb', wt.DWORD), ('lpReserved', wt.LPWSTR), ('lpDesktop', wt.LPWSTR), ('lpTitle', wt.LPWSTR), ('dwX', wt.DWORD), ('dwY', wt.DWORD),
                ('dwXSize', wt.DWORD), ('dwYSize', wt.DWORD), ('dwXCountChars', wt.DWORD), ('dwYCountChars', wt.DWORD), ('dwFillAttribute', wt.DWORD),
                ('dwFlags', wt.DWORD), ('wShowWindow', wt.WORD), ('cbReserved2', wt.WORD), ('lpReserved2', ctypes.c_void_p), ('hStdInput', H),
                ('hStdOutput', H), ('hStdError', H)]


class STARTUPINFOEXW(ctypes.Structure):
    _fields_ = [('StartupInfo', STARTUPINFOW), ('lpAttributeList', ctypes.c_void_p)]


class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [('hProcess', H), ('hThread', H), ('dwProcessId', wt.DWORD), ('dwThreadId', wt.DWORD)]


k.CreatePipe.argtypes = [ctypes.POINTER(H), ctypes.POINTER(H), ctypes.c_void_p, wt.DWORD]
k.CreatePseudoConsole.argtypes = [COORD, H, H, wt.DWORD, ctypes.POINTER(H)]
k.ClosePseudoConsole.argtypes = [H]
k.CloseHandle.argtypes = [H]
k.ReadFile.argtypes = [H, ctypes.c_void_p, wt.DWORD, ctypes.POINTER(wt.DWORD), ctypes.c_void_p]
k.WriteFile.argtypes = [H, ctypes.c_void_p, wt.DWORD, ctypes.POINTER(wt.DWORD), ctypes.c_void_p]
k.InitializeProcThreadAttributeList.argtypes = [ctypes.c_void_p, wt.DWORD, wt.DWORD, ctypes.POINTER(ctypes.c_size_t)]
k.UpdateProcThreadAttribute.argtypes = [ctypes.c_void_p, wt.DWORD, ctypes.c_size_t, H, ctypes.c_size_t, ctypes.c_void_p, ctypes.c_void_p]
k.CreateProcessW.argtypes = [wt.LPCWSTR, wt.LPWSTR, ctypes.c_void_p, ctypes.c_void_p, wt.BOOL, wt.DWORD, ctypes.c_void_p, wt.LPCWSTR,
                             ctypes.POINTER(STARTUPINFOEXW), ctypes.POINTER(PROCESS_INFORMATION)]
k.WaitForSingleObject.argtypes = [H, wt.DWORD]
k.GetExitCodeProcess.argtypes = [H, ctypes.POINTER(wt.DWORD)]
k.TerminateProcess.argtypes = [H, wt.UINT]

ANSI = re.compile(r'\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[=>]')


def rodar(linha, passos, tempo=25):
    """passos: lista de (esperar_regex|None, enviar_texto). Devolve (codigo, saida_sem_ansi)."""
    in_r, in_w, out_r, out_w = H(), H(), H(), H()
    assert k.CreatePipe(ctypes.byref(in_r), ctypes.byref(in_w), None, 0)
    assert k.CreatePipe(ctypes.byref(out_r), ctypes.byref(out_w), None, 0)
    hpc = H()
    assert k.CreatePseudoConsole(COORD(120, 30), in_r, out_w, 0, ctypes.byref(hpc)) == 0
    k.CloseHandle(in_r); k.CloseHandle(out_w)
    tam = ctypes.c_size_t()
    k.InitializeProcThreadAttributeList(None, 1, 0, ctypes.byref(tam))
    lista = ctypes.create_string_buffer(tam.value)
    assert k.InitializeProcThreadAttributeList(lista, 1, 0, ctypes.byref(tam))
    assert k.UpdateProcThreadAttribute(lista, 0, 0x00020016, hpc, ctypes.sizeof(H), None, None)
    si = STARTUPINFOEXW(); si.StartupInfo.cb = ctypes.sizeof(si); si.lpAttributeList = ctypes.cast(lista, ctypes.c_void_p)
    si.StartupInfo.dwFlags = 0x100  # STARTF_USESTDHANDLES com handles nulos: o filho usa o console emulado, não os handles do pai
    pi = PROCESS_INFORMATION()
    cmd = ctypes.create_unicode_buffer(linha)
    assert k.CreateProcessW(None, cmd, None, None, False, 0x00080000, None, None, ctypes.byref(si), ctypes.byref(pi)), ctypes.get_last_error()
    bruto = bytearray()

    def ler():
        b = ctypes.create_string_buffer(4096); n = wt.DWORD()
        while k.ReadFile(out_r, b, 4096, ctypes.byref(n), None) and n.value:
            bruto.extend(b.raw[:n.value])

    t = threading.Thread(target=ler, daemon=True); t.start()
    limpo = lambda: ANSI.sub('', bruto.decode('utf-8', 'replace')).replace('\r', '')
    fim = time.time() + tempo
    for esperar, enviar in passos:
        while esperar and not re.search(esperar, limpo()) and time.time() < fim:
            time.sleep(0.05)
        for ch in enviar:  # digita uma tecla por vez
            dado = ch.encode('utf-8'); n = wt.DWORD()
            k.WriteFile(in_w, dado, len(dado), ctypes.byref(n), None); time.sleep(0.03)
        time.sleep(0.15)
    estado = k.WaitForSingleObject(pi.hProcess, max(0, int((fim - time.time()) * 1000)))
    if estado != 0:
        k.TerminateProcess(pi.hProcess, 99)
    codigo = wt.DWORD(); k.GetExitCodeProcess(pi.hProcess, ctypes.byref(codigo))
    time.sleep(0.3)
    k.ClosePseudoConsole(hpc); t.join(2)
    k.CloseHandle(in_w); k.CloseHandle(out_r)
    return codigo.value, limpo(), estado != 0


FALSA = 'node'
ROOT = os.getcwd()
PORTA = 7191
ESC = '\x1b'


def cenario(nome, modo, passos, verificar):
    pasta = tempfile.mkdtemp(prefix='dmanda-conpty-')
    reg = os.path.join(pasta, 'puts.log')
    open(reg, 'w').close()
    auth = subprocess.Popen(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'auth-falso.mjs'), str(PORTA), modo, reg])
    time.sleep(0.8)
    os.environ.update(NEXT_PUBLIC_SUPABASE_URL=f'http://127.0.0.1:{PORTA}', SUPABASE_SERVICE_ROLE_KEY='sb_secret_falsa_para_teste',
                      DMANDA_EMAIL_AUTORIZADO='conta-de-teste@exemplo.invalid')
    try:
        codigo, saida, estourou = rodar('node scripts/definir-senha.mjs', passos)
    finally:
        auth.kill(); auth.wait()
    puts = [json.loads(l) for l in open(reg, encoding='utf-8').read().splitlines() if l.strip()]
    shutil.rmtree(pasta, ignore_errors=True)
    res = verificar(codigo, saida, puts) and not estourou
    print(('ok     ' if res else 'FALHOU ') + nome + f'  [saída {codigo}, PUTs {len(puts)}' + (', ESTOUROU O TEMPO' if estourou else '') + ']')
    if not res:
        print('   saída:', repr(saida[-400:]), ' senha enviada:', [p.get('password') for p in puts])
    return res


P1 = 'frase-longa-de-teste-123'
resultados = []
A = resultados.append
sem_eco = lambda s, *senhas: not any(x in s for x in senhas)
PEDE1, PEDE2 = r'Nova senha', r'Repita a senha'

A(cenario('terminal real: duas digitações iguais definem a senha, e ela não aparece na tela', 'ok',
          [(PEDE1, P1 + '\r'), (PEDE2, P1 + '\r')],
          lambda c, s, p: c == 0 and len(p) == 1 and p[0].get('password') == P1 and sem_eco(s, P1, 'sb_secret') and 'Senha definida' in s))
A(cenario('terminal real: senhas diferentes não alteram nada', 'ok',
          [(PEDE1, P1 + '\r'), (PEDE2, P1 + 'x\r')],
          lambda c, s, p: c == 1 and not p and 'não são iguais' in s and sem_eco(s, P1)))
A(cenario('terminal real: Ctrl+C no primeiro campo cancela sem alterar', 'ok',
          [(PEDE1, 'abc\x03')],
          lambda c, s, p: c == 1 and not p and 'Cancelado' in s))
A(cenario('terminal real: Ctrl+C na confirmação cancela sem alterar', 'ok',
          [(PEDE1, P1 + '\r'), (PEDE2, 'abc\x03')],
          lambda c, s, p: c == 1 and not p and 'Cancelado' in s and sem_eco(s, P1)))
A(cenario('terminal real: Backspace corrige o que foi digitado (nos dois formatos, 0x7f e 0x08)', 'ok',
          [(PEDE1, P1 + 'ZZ\x7f\x08\r'), (PEDE2, P1 + 'Q\x08\r')],
          lambda c, s, p: c == 0 and len(p) == 1 and p[0].get('password') == P1))
A(cenario('terminal real: senha curta é recusada sem chamar o Supabase', 'ok',
          [(PEDE1, 'curta\r'), (PEDE2, 'curta\r')],
          lambda c, s, p: c == 1 and not p and 'pelo menos 12' in s))
A(cenario('terminal real: senha com mais de 72 caracteres é recusada sem chamar o Supabase', 'ok',
          [(PEDE1, ('a' * 73) + '\r'), (PEDE2, ('a' * 73) + '\r')],
          lambda c, s, p: c == 1 and not p and '72' in s))
A(cenario('terminal real: seta e Delete não entram na senha como texto', 'ok',
          [(PEDE1, 'frase-longa-de' + ESC + '[A' + ESC + '[D' + ESC + '[3~' + '-teste-123\r'), (PEDE2, P1 + '\r')],
          lambda c, s, p: c == 0 and len(p) == 1 and p[0].get('password') == P1))
A(cenario('terminal real: chave de serviço recusada pelo Supabase mostra erro sem vazar a chave', 'erro401',
          [(PEDE1, P1 + '\r'), (PEDE2, P1 + '\r')],
          lambda c, s, p: c == 1 and not p and 'recusou a consulta' in s and sem_eco(s, P1, 'sb_secret')))
A(cenario('terminal real: senha fraca pela regra do projeto orienta e não vaza a senha', 'fraca',
          [(PEDE1, P1 + '\r'), (PEDE2, P1 + '\r')],
          lambda c, s, p: c == 1 and 'weak_password' in s and sem_eco(s, P1)))
print(f'\n{sum(resultados)}/{len(resultados)} cenários de terminal passaram')
sys.exit(0 if all(resultados) else 1)
