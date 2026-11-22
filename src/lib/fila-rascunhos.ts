// Motor dos rascunhos online (decisão 92). O BANCO é a fonte principal; o armazenamento do navegador guarda só a FILA TEMPORÁRIA de alterações ainda não confirmadas, separada por usuário.
// Módulo puro (sem React, sem fetch): recebe a API, o armazenamento e os temporizadores, então é testado em Node contra as funções reais do banco (scripts/testar-fila-rascunhos.mjs).
//
// Regras (cada uma tem teste):
//  - cada chave de rascunho (nova, e:<id>, ...) tem UMA instância (id) por vez; a instância tem a versão que o banco confirmou e uma operação (op) por edição local;
//  - o envio é serial, agrupado (espera curta depois da última edição, com limite máximo durante digitação contínua) e repetível: a resposta perdida é reenviada com a MESMA op;
//  - uma resposta de gravação anterior nunca apaga uma edição mais recente: só a op que foi enviada é dada como confirmada;
//  - nada sai da fila por idade nem por falha; só sai com a confirmação do banco (versão correspondente, lápide ou 'encerrado');
//  - encerrar (consumir ou descartar) deixa uma LÁPIDE no banco: uma fila antiga que reenviar a instância recebe 'encerrado' e não a recria;
//  - conflito (outro aparelho gravou antes) preserva as duas versões: a do banco fica, a local também; o envio automático daquela chave para até a pessoa resolver;
//  - a fila de um usuário nunca é lida por outro (a chave do armazenamento leva o id do usuário).
import { eObjeto } from './armazenamento.ts';

export type Dados = Record<string, unknown>;
export type RespostaBanco =
  | { status: 'ok'; id: string; versao: number; repetida?: boolean }
  | { status: 'conflito'; id: string; versao: number; dados: Dados; conflitos: { op: string; dados: Dados; em?: string; instancia?: string }[] }
  | { status: 'encerrado'; id: string; estado: string };
export type RascunhoNoBanco = { id: string; chave: string; dados: Dados; versao: number; conflitos: { op: string; dados: Dados }[] };
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string; revogado?: boolean; outraConta?: boolean };
export type Api = {
  listar(): Promise<Resultado<RascunhoNoBanco[]>>;
  salvar(id: string, chave: string, dados: Dados, base: number, op: string): Promise<Resultado<RespostaBanco>>;
  resolver(id: string, dados: Dados, base: number, op: string): Promise<Resultado<RespostaBanco>>;
  encerrar(id: string, chave: string, estado: 'consumido' | 'descartado'): Promise<Resultado<unknown>>;
};
export type Armazem = { ler(chave: string): string | null; gravar(chave: string, valor: string): void };
/** `naoVisto`: chegou do banco DEPOIS de as janelas serem liberadas (leitura atrasada ou que falhou e voltou): a janela aberta pode não tê-lo carregado, então nem um descarte nem uma digitação dela podem atingi-lo. */
export type Item = { id: string; chave: string; valor: Dados; versao: number; op: string; pendente: boolean; conflito: { versao: number; dados: Dados; outras: number } | null; naoVisto?: boolean };
export type Lapide = { id: string; chave: string; estado: 'consumido' | 'descartado' };
/** `dono`: de quem é esta fila (identificação estável, mostrada se o acesso for revogado com alterações ainda não enviadas). */
type Fila = { v: 1; itens: Record<string, Item>; lapides: Lapide[]; dono?: { id: string; email: string | null } };
export type EstadoRascunhos = 'nenhum' | 'salvando' | 'salvo' | 'pendente' | 'falha' | 'bloqueado';
/** O estado de UM rascunho: salvo online (confirmado), salvando, pendente neste aparelho, erro de sincronização ou conflito entre aparelhos. */
export type EstadoRascunho = 'salvo' | 'salvando' | 'pendente' | 'falha' | 'conflito';
/** Por que o envio parou de vez: o acesso foi revogado, ou a sessão deste navegador agora é de outra conta (a fila não é enviada em nome dela). */
export type Bloqueio = 'revogado' | 'outraConta';

export const CHAVE_FILA = (usuarioId: string) => `dmanda:fila:${usuarioId}`;
const ATRASOS_RETENTATIVA = [2000, 5000, 15_000, 30_000, 60_000];

export type Opcoes = {
  usuarioId: string; email?: string | null; api: Api; armazem: Armazem; aoMudar?: () => void;
  novoId?: () => string; agendar?: (f: () => void, ms: number) => unknown; cancelar?: (t: unknown) => void;
  esperaMs?: number; esperaMaxMs?: number; agora?: () => number; online?: () => boolean;
  /** Serializa o envio entre abas do mesmo aparelho (Web Locks no navegador). */
  exclusivo?: <T>(f: () => Promise<T>) => Promise<T>;
};

const filaVazia = (): Fila => ({ v: 1, itens: {}, lapides: [] });
const idPadrao = () => crypto.randomUUID();

export class MotorRascunhos {
  private o: Required<Pick<Opcoes, 'usuarioId' | 'api' | 'armazem' | 'esperaMs' | 'esperaMaxMs' | 'novoId' | 'agendar' | 'cancelar' | 'agora' | 'online' | 'exclusivo'>> & { aoMudar: () => void };
  private emVoo = 0;
  private falhou = false;
  private tentativas = 0;
  private timer: unknown = null;
  private timerMax: unknown = null;
  private timerRetentativa: unknown = null;
  private corrente: Promise<void> | null = null;
  private denovo = false;
  private parado = false;
  private ultimaEdicao = 0;
  private email: string | null = null;
  /** Envio parado por revogação ou troca de conta: nada mais é enviado nem tentado; a fila fica guardada, com o dono. */
  bloqueio: Bloqueio | null = null;
  /** true depois da primeira leitura do banco (com ou sem sucesso): as janelas só abrem depois, para não começarem sem o rascunho que já existe online. */
  pronto = false;
  /** A primeira leitura do banco ainda não foi confirmada (demorou além do limite ou falhou): nada foi dado como inexistente; a tela avisa e oferece tentar de novo. */
  leituraPendente = false;

  constructor(o: Opcoes) {
    this.o = {
      usuarioId: o.usuarioId, api: o.api, armazem: o.armazem, aoMudar: o.aoMudar ?? (() => {}), novoId: o.novoId ?? idPadrao,
      agendar: o.agendar ?? ((f, ms) => setTimeout(f, ms)), cancelar: o.cancelar ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>)),
      esperaMs: o.esperaMs ?? 400, esperaMaxMs: o.esperaMaxMs ?? 2000, agora: o.agora ?? (() => Date.now()),
      online: o.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false)), exclusivo: o.exclusivo ?? (async (f) => f()),
    };
    this.email = o.email ?? null;
  }

  // ---------- armazenamento (sempre lido na hora: outra aba pode ter mexido) ----------
  private ler(): Fila {
    try {
      const t = this.o.armazem.ler(CHAVE_FILA(this.o.usuarioId));
      const v: unknown = t ? JSON.parse(t) : null;
      if (!eObjeto(v) || v.v !== 1 || !eObjeto(v.itens)) return filaVazia();
      const itens: Record<string, Item> = {};
      for (const [k, x] of Object.entries(v.itens)) if (eObjeto(x) && typeof x.id === 'string' && eObjeto(x.valor) && typeof x.versao === 'number' && typeof x.op === 'string') itens[k] = { id: x.id, chave: k, valor: x.valor as Dados, versao: x.versao, op: x.op, pendente: x.pendente === true, conflito: eObjeto(x.conflito) ? (x.conflito as Item['conflito']) : null };
      const lapides = Array.isArray(v.lapides) ? v.lapides.filter((l): l is Lapide => eObjeto(l) && typeof l.id === 'string' && typeof l.chave === 'string' && (l.estado === 'consumido' || l.estado === 'descartado')) : [];
      const dono = eObjeto(v.dono) && typeof v.dono.id === 'string' ? { id: v.dono.id, email: typeof v.dono.email === 'string' ? v.dono.email : null } : undefined;
      return { v: 1, itens, lapides, dono };
    } catch { return filaVazia(); }
  }
  private gravar(f: Fila) { try { this.o.armazem.gravar(CHAVE_FILA(this.o.usuarioId), JSON.stringify(f)); } catch { /* sem armazenamento: a fila vale só nesta visita */ } }
  /** O que já foi CONFIRMADO pelo banco fica só na memória desta aba (nunca no armazenamento do navegador): o armazenamento guarda apenas o que ainda não chegou ao banco. */
  private cache: Record<string, Item> = {};
  private mutar(f: (fila: Fila) => void) {
    const fila = this.ler();
    fila.itens = { ...this.cache, ...fila.itens };
    f(fila);
    const novo: Record<string, Item> = {};
    for (const [k, i] of Object.entries(fila.itens)) if (!i.pendente && !i.conflito) { novo[k] = i; delete fila.itens[k]; }
    this.cache = novo;
    fila.dono = { id: this.o.usuarioId, email: this.email ?? fila.dono?.email ?? null };
    this.gravar(fila);
    this.o.aoMudar();
  }
  private todos(): Record<string, Item> { return { ...this.cache, ...this.ler().itens }; }

  // ---------- leitura para a interface ----------
  /** O que as janelas leem: o conteúdo de cada chave com rascunho aberto. */
  rascunhos(): Record<string, Dados> { const r: Record<string, Dados> = {}; for (const [k, i] of Object.entries(this.todos())) r[k] = i.valor; return r; }
  conflitos(): { chave: string; versao: number; outras: number }[] { return Object.values(this.todos()).filter((i) => i.conflito).map((i) => ({ chave: i.chave, versao: i.conflito!.versao, outras: i.conflito!.outras })); }
  estado(): EstadoRascunhos {
    const f = this.ler();
    const itens = Object.values(this.todos());
    if (this.bloqueio) return 'bloqueado';
    if (this.emVoo > 0 || this.timer) return 'salvando';
    if (this.falhou) return 'falha';
    if (itens.some((i) => i.pendente) || f.lapides.length || itens.some((i) => i.conflito)) return 'pendente';
    return itens.length ? 'salvo' : 'nenhum';
  }
  /** O estado de cada rascunho aberto (o texto de cada janela vem daqui). */
  porChave(): Record<string, EstadoRascunho> {
    const r: Record<string, EstadoRascunho> = {};
    for (const [k, i] of Object.entries(this.todos())) r[k] = i.conflito ? 'conflito' : !i.pendente ? 'salvo' : this.bloqueio || this.falhou ? 'falha' : this.emVoo > 0 || this.timer ? 'salvando' : 'pendente';
    return r;
  }
  /** De quem é a fila guardada neste navegador para este usuário (identificação mostrada se o acesso for revogado). */
  dono(): { id: string; email: string | null } { return this.ler().dono ?? { id: this.o.usuarioId, email: this.email }; }
  /** Quantas alterações ainda não foram confirmadas pelo banco. */
  pendentes(): number { const f = this.ler(); return Object.values(f.itens).filter((i) => i.pendente).length + f.lapides.length; }

  // ---------- início: junta a fila deste usuário com o que o banco tem ----------
  async iniciar(): Promise<void> {
    await this.sincronizar();
    void this.enviar();
  }
  /** Lê os rascunhos abertos do banco e os junta à fila (a fila local pendente sempre vence o que o banco tem, e o conflito é tratado no envio). */
  async sincronizar(): Promise<boolean> {
    let r: Resultado<RascunhoNoBanco[]>;
    try { r = await this.o.api.listar(); } catch { this.leituraFalhou(); return false; }
    if (!r.ok) { if (r.revogado || r.outraConta) this.bloquear(r.revogado ? 'revogado' : 'outraConta'); this.leituraFalhou(); return false; }
    const tarde = this.pronto;   // as janelas já foram liberadas: o que chega agora pode não ter sido visto por uma janela aberta
    this.mutar((fila) => {
      const encerrando = new Set(fila.lapides.map((l) => l.id));
      for (const d of r.dados) {
        if (encerrando.has(d.id)) continue;
        const atual = fila.itens[d.chave];
        const conflito = d.conflitos.length ? { versao: d.versao, dados: d.dados, outras: d.conflitos.length } : null;
        if (!atual) { fila.itens[d.chave] = { id: d.id, chave: d.chave, valor: d.dados, versao: d.versao, op: this.o.novoId(), pendente: false, conflito, naoVisto: tarde }; continue; }
        if (atual.pendente) continue;   // o que a pessoa digitou aqui e ainda não foi confirmado vale; o envio decide (conflito, se houver)
        if (atual.id !== d.id || d.versao > atual.versao) fila.itens[d.chave] = { id: d.id, chave: d.chave, valor: d.dados, versao: d.versao, op: this.o.novoId(), pendente: false, conflito, naoVisto: tarde };
        else if (conflito && !atual.conflito) atual.conflito = conflito;
      }
    });
    this.leituraPendente = false;
    this.marcarPronto();
    return true;
  }

  /** O e-mail do dono chega depois (a identidade vem do servidor): só serve para identificar a fila guardada. */
  definirEmail(e: string | null) { this.email = e; }
  /** A primeira leitura demorou demais (rede presa): as janelas abrem com o que há na fila local, e o que estiver no banco chega pela sincronização seguinte. */
  forcarPronto() { if (!this.pronto) { this.leituraPendente = true; this.marcarPronto(); } }
  private leituraFalhou() { if (!this.pronto) this.leituraPendente = true; this.marcarPronto(); }
  /** Uma janela acabou de abrir lendo `rascunhos()`: o que está na memória agora foi visto por ela. */
  marcarVistos() { this.mutar((fila) => { for (const i of Object.values(fila.itens)) delete i.naoVisto; }); }
  /** Chaves com rascunho online que chegou depois de a janela abrir (preservado; reabrir a janela o recupera). */
  naoVistos(): string[] { return Object.values(this.todos()).filter((i) => i.naoVisto).map((i) => i.chave); }
  private marcarPronto() { if (!this.pronto) { this.pronto = true; this.o.aoMudar(); } }
  private bloquear(b: Bloqueio) {
    this.bloqueio = b;
    for (const t of [this.timer, this.timerRetentativa]) if (t) this.o.cancelar(t);
    this.timer = this.timerRetentativa = null;
    this.o.aoMudar();
  }

  // ---------- edição ----------
  /** Guarda (ou, com null, encerra) o rascunho da chave. Nunca espera a rede: grava na fila e agenda o envio agrupado. */
  guardar(chave: string, valor: Dados | null): void {
    let mudou = true;
    this.mutar((fila) => {
      const atual = fila.itens[chave];
      if (valor === null) {
        // descartar o que a janela não carregou apagaria um rascunho online que a pessoa nem viu: fica como está
        if (atual?.naoVisto) { mudou = false; return; }
        if (atual) { fila.lapides.push({ id: atual.id, chave, estado: 'descartado' }); delete fila.itens[chave]; }
        return;
      }
      // digitar numa janela que não carregou o rascunho online: vira OUTRA instância; o banco mantém a online e guarda esta ao lado (conflito, as duas preservadas), nunca sobrescreve
      if (atual?.naoVisto) { fila.itens[chave] = { id: this.o.novoId(), chave, valor, versao: 0, op: this.o.novoId(), pendente: true, conflito: null }; return; }
      if (atual && JSON.stringify(atual.valor) === JSON.stringify(valor)) { mudou = false; return; }   // nada mudou: não gasta envio
      if (atual) { atual.valor = valor; atual.op = this.o.novoId(); atual.pendente = true; }
      else fila.itens[chave] = { id: this.o.novoId(), chave, valor, versao: 0, op: this.o.novoId(), pendente: true, conflito: null };
    });
    if (mudou) this.agendarEnvio(valor !== null);
  }
  /** O registro definitivo foi confirmado: o rascunho é CONSUMIDO (a lápide impede que uma fila antiga o recrie). */
  consumir(chave: string): void {
    this.mutar((fila) => { const a = fila.itens[chave]; if (a) { fila.lapides.push({ id: a.id, chave, estado: 'consumido' }); delete fila.itens[chave]; } });
    this.agendarEnvio(false);
  }

  private agendarEnvio(edicao: boolean) {
    if (this.parado || this.bloqueio) { this.o.aoMudar(); return; }
    const agora = this.o.agora();
    if (edicao && !this.ultimaEdicao) this.ultimaEdicao = agora;
    if (this.timer) this.o.cancelar(this.timer);
    // espera curta depois da última alteração; durante digitação contínua, no máximo esperaMaxMs desde a primeira ainda não enviada
    const restante = edicao ? Math.max(0, this.o.esperaMaxMs - (agora - this.ultimaEdicao)) : 0;
    this.timer = this.o.agendar(() => { this.timer = null; this.ultimaEdicao = 0; void this.enviar(); }, Math.min(this.o.esperaMs, restante));
    this.o.aoMudar();
  }

  /** Envia agora (sem esperar o agrupamento): ao sair de cena, ao voltar a conexão ou no botão Tentar de novo. */
  async enviarAgora(): Promise<void> {
    if (this.timer) { this.o.cancelar(this.timer); this.timer = null; this.ultimaEdicao = 0; }
    if (this.timerRetentativa) { this.o.cancelar(this.timerRetentativa); this.timerRetentativa = null; }
    await this.enviar();
  }
  tentarDeNovo(): Promise<void> { this.tentativas = 0; return (this.leituraPendente ? this.sincronizar().then(() => undefined) : Promise.resolve()).then(() => this.enviarAgora()); }

  // ---------- envio serial ----------
  private enviar(): Promise<void> {
    if (this.parado || this.bloqueio) return Promise.resolve();
    // já há envio em andamento: quem pediu espera ESSE envio (que inclui uma nova passada, se pediram durante ele); nunca devolve antes de a fila ter sido atendida
    if (this.corrente) { this.denovo = true; return this.corrente; }
    this.corrente = (async () => {
      try {
        do {
          this.denovo = false;
          await this.o.exclusivo(() => this.enviarTudo());   // em falha a retentativa já foi agendada; um pedido explícito feito durante o envio ainda gera uma passada
        } while (this.denovo && !this.parado && !this.bloqueio);
      } catch { this.falhar(); }   // nada aqui pode virar rejeição sem dono (a fila continua guardada e a retentativa já está agendada)
      finally { this.corrente = null; this.o.aoMudar(); }
    })();
    return this.corrente;
  }

  /** false quando algo falhou (a retentativa já foi agendada). */
  private async enviarTudo(): Promise<boolean> {
    // 1) lápides primeiro (uma instância encerrada nunca mais pode ser gravada)
    for (const l of [...this.ler().lapides]) {
      const ok = await this.chamar(() => this.o.api.encerrar(l.id, l.chave, l.estado));
      if (!ok) return false;
      this.mutar((fila) => { fila.lapides = fila.lapides.filter((x) => !(x.id === l.id && x.chave === l.chave)); });
    }
    // 2) gravações pendentes, uma chave por vez
    for (const chave of Object.keys(this.ler().itens)) {
      const it = this.ler().itens[chave];
      if (!it || !it.pendente || it.conflito) continue;
      const r = await this.chamar(() => this.o.api.salvar(it.id, it.chave, it.valor, it.versao, it.op));
      if (!r) return false;
      this.aplicar(chave, it, r);
    }
    this.falhou = false; this.tentativas = 0;
    // uma edição feita durante o envio continua pendente: nova passada
    if (Object.values(this.ler().itens).some((i) => i.pendente && !i.conflito) || this.ler().lapides.length) this.denovo = true;
    return true;
  }

  /** Aplica a resposta SÓ à instância e à operação que foram enviadas: uma edição mais recente continua pendente. */
  private aplicar(chave: string, enviado: Item, r: RespostaBanco) {
    this.mutar((fila) => {
      const it = fila.itens[chave];
      if (!it || it.id !== enviado.id) return;   // a instância mudou enquanto a resposta vinha: nada a aplicar
      if (r.status === 'ok') { it.versao = r.versao; if (it.op === enviado.op) it.pendente = false; return; }
      if (r.status === 'encerrado') { delete fila.itens[chave]; return; }   // encerrada em outro aparelho: não se recria
      // conflito: a versão local já ficou guardada ao lado no banco; as duas existem. O envio da chave para até a pessoa resolver.
      it.id = r.id; it.versao = r.versao; it.pendente = false;
      it.conflito = { versao: r.versao, dados: r.dados, outras: r.conflitos.length };
    });
  }

  /** Resolve o conflito de uma chave: 'meu' grava o conteúdo local como o do banco; 'outro' adota o do banco. Os dois só deixam de existir por esta escolha explícita. */
  async resolver(chave: string, escolha: 'meu' | 'outro'): Promise<boolean> {
    const it = this.ler().itens[chave];
    if (!it?.conflito) return true;
    const dados = escolha === 'meu' ? it.valor : it.conflito.dados, op = this.o.novoId();
    const r = await this.chamar(() => this.o.api.resolver(it.id, dados, it.conflito!.versao, op));
    if (!r) return false;
    this.mutar((fila) => {
      const x = fila.itens[chave];
      if (!x || x.id !== it.id) return;
      if (r.status === 'ok') { x.versao = r.versao; x.valor = dados; x.conflito = null; x.pendente = false; x.op = op; }
      else if (r.status === 'conflito') x.conflito = { versao: r.versao, dados: r.dados, outras: r.conflitos.length };
      else delete fila.itens[chave];
    });
    return true;
  }

  /** Uma chamada ao banco: retorna a resposta, ou null depois de marcar a falha e agendar a retentativa. Exceção (rede, sessão) e recusa viram falha; nada sai da fila. */
  private async chamar<T>(f: () => Promise<Resultado<T>>): Promise<T | null> {
    this.emVoo++; this.o.aoMudar();
    try {
      const r = await f();
      if (r.ok) return r.dados;
      if (r.revogado || r.outraConta) { this.bloquear(r.revogado ? 'revogado' : 'outraConta'); return null; }   // não é falha passageira: nada de retentativa, e a fila fica guardada
      this.falhar();
      return null;
    } catch { this.falhar(); return null; }
    finally { this.emVoo--; this.o.aoMudar(); }
  }
  private falhar() {
    this.falhou = true;
    if (this.parado || this.bloqueio || this.timerRetentativa) return;
    const atraso = ATRASOS_RETENTATIVA[Math.min(this.tentativas, ATRASOS_RETENTATIVA.length - 1)];
    this.tentativas++;
    this.timerRetentativa = this.o.agendar(() => { this.timerRetentativa = null; void this.enviar(); }, atraso);
  }

  parar() { this.parado = true; for (const t of [this.timer, this.timerRetentativa]) if (t) this.o.cancelar(t); this.timer = this.timerRetentativa = null; }
}
