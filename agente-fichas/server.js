/* ===========================================================
   agente-fichas — a conversa do funcionário Fichas.

   Em vez de preencher a telinha, o dono manda imagens e informações
   como faria numa conversa com o Claude, e o Claude monta a ficha.
   Cada cliente tem a própria conversa, que continua de onde parou.

   O Claude Code roda na pasta do sistema de fichas, com as regras e
   a memória que esse projeto já tem. Sem dependências: só Node.js.
   =========================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pipeline } = require('stream');
const { acharClaude } = require('../claude-bin');

// a mesma conversa serve aos dois funcionários; AGENTE=desenho troca as regras e as pastas
const EH_DESENHO = process.env.AGENTE === 'desenho';
const PORTA = Number(process.env.PORT) || (EH_DESENHO ? 4404 : 4403);
const PROJETO = process.env.FICHAS_PROJETO || (EH_DESENHO ? path.join(os.homedir(), 'Downloads', 'SAFUL') : path.join(os.homedir(), 'Desktop', 'sistema automação wpp'));
const PASTA_FICHAS = process.env.FICHAS_DRIVE || 'G:\\Meu Drive\\AUTOMAÇÃO LEDSPORTS ATIBAIA\\FICHAS';
const PASTA_ARTES = process.env.DESENHO_DRIVE || 'G:\\Meu Drive\\AUTOMAÇÃO LEDSPORTS ATIBAIA\\DESENHO\\ARTES\\CLIENTES';
const DADOS = process.env.FICHAS_DADOS || path.join(__dirname, EH_DESENHO ? 'dados-desenho' : 'dados');
const ARQ_CONVERSAS = path.join(DADOS, 'conversas.json');
const LIMITE_ARQUIVO = 200 * 1024 * 1024;
const LIMITE_JSON = 200 * 1024;
const LIMITE_EXECUCAO = (EH_DESENHO ? 45 : 15) * 60 * 1000;
const FERRAMENTAS = 'Read,Write,Edit,Glob,Grep,Bash,PowerShell';

const PAPEL_FICHAS = [
  'Você é o funcionário Fichas da LED SPORTS. O dono manda imagens, listas e informações do pedido, e você monta a ficha.',
  'Fale em português do Brasil, em texto simples e curto.',
  'O sistema de fichas está em app/ (leia app/server.js e app/layout.js para ver como gerar; gerar_ficha.ps1 usa o Excel). Bases, pastas e lojas estão em app/config.json e os preços em app/catalogo.json.',
  'Se faltar algo que muda a ficha ou o financeiro (loja, modelo, patch, preço, nome ou só número, grafia duvidosa), pergunte tudo numa mensagem só ANTES de gerar. Não gere com palpite.',
  'Ao terminar, escreva o caminho completo de cada PDF gerado e o resumo de peças e valores para o dono conferir. O pedido pode ter vindo pelo WhatsApp, então seja breve.',
  'Limites: nunca envie nada ao cliente; nunca ligue, desligue ou altere o robô do WhatsApp (atendente/); nunca leia arquivos .env; nunca grave, mova ou apague nada no Nextcloud; não apague fichas existentes sem o dono pedir.'
].join('\n');

const PAPEL_DESENHO = [
  'Você é o funcionário Desenho da LED SPORTS. O dono manda referências, logos, patrocínios e informações, e você monta o uniforme.',
  'Fale em português do Brasil, em texto simples e curto. Trabalhe como nas conversas de desenho: suas regras estão na memória deste projeto e em Desktop\\CLAUDE\\TUDO QUE O CLAUDE SABE.md.',
  'Tudo do desenho fica em G:\\Meu Drive\\AUTOMAÇÃO LEDSPORTS ATIBAIA\\DESENHO: MOLDE DE COSTURA (CDR), BASE MOCKUPS (PSD), BANCO DE DADOS (fundos por tema e a pasta AIMARI), REFERENCIAS e ARTES. Procure fundos primeiro em BANCO DE DADOS. Nunca altere os arquivos base: copie para DESENHO\\ARTES\\CLIENTES\\<CLIENTE> e trabalhe na cópia. Salve lá o CDR, o PSD e o JPG. Os anexos recebidos estão em DESENHO\\ARTES\\CLIENTES\\<CLIENTE>\\ENTRADA.',
  'Os scripts de Corel e Photoshop estão em Desktop\\_SCRIPTS LED. Eles vieram de outro computador: troque caminhos antigos (C:\\Users\\Gigabyte Aorus, Desktop\\MODELOS, Desktop\\CLIENTES) antes de usar. Cores: Desktop\\CORES COREL.xml.',
  'Se o dono disser que já é cliente da loja, procure pelo nome em LED SPORTS Dropbox e no Nextcloud, só para ver, antes de vetorizar. Cliente novo não precisa disso.',
  'Você não tem navegador aqui. Se precisar de vetor do Aimari ou do Firefly, diga exatamente o que falta e peça para o dono mandar o arquivo.',
  'Fluxo obrigatório: monte o molde, exporte a prévia em JPG ou PNG, escreva o caminho completo dela e PARE esperando a aprovação. Só faça o mockup depois do ok. Ao terminar o mockup, escreva o caminho completo do JPG. Se faltar algo que muda o desenho, pergunte tudo numa mensagem só.',
  'Limites: nunca envie nada ao cliente; nunca ligue, desligue ou altere o robô do WhatsApp; nunca leia arquivos .env; nunca grave, mova ou apague nada no Nextcloud; não apague trabalhos existentes sem o dono pedir.'
].join('\n');
const PAPEL = EH_DESENHO ? PAPEL_DESENHO : PAPEL_FICHAS;

/* ---------- conversas em disco ---------- */
let conversas = [];
try { conversas = JSON.parse(fs.readFileSync(ARQ_CONVERSAS, 'utf8')); } catch (e) { /* primeira vez */ }
// o que estava rodando quando o servidor caiu não volta sozinho
for (const c of conversas) {
  if (c.estado !== 'parada') { c.estado = 'parada'; c.historico.push({ quem: 'sistema', texto: 'O serviço reiniciou e esta resposta se perdeu. Mande a mensagem de novo.', quando: Date.now() }); }
}

function gravar() {
  fs.mkdirSync(DADOS, { recursive: true });
  const tmp = ARQ_CONVERSAS + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(conversas, null, 2));
  fs.renameSync(tmp, ARQ_CONVERSAS);
}

const limparNome = (t, lim = 80) => String(t || '')
  .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, lim).trim();
const pastaAnexos = c => EH_DESENHO ? path.join(PASTA_ARTES, c.cliente, 'ENTRADA') : path.join(PASTA_FICHAS, 'PEDIDOS RECEBIDOS', c.cliente);
const resumo = c => ({ id: c.id, cliente: c.cliente, estado: c.estado, quando: c.atualizado });

/* ---------- Claude: um pedido por vez, porque o Excel só aguenta um ---------- */
const fila = [];
let ocupado = false;

function comandoClaude() {
  if (process.env.FICHAS_CLAUDE_CMD) return JSON.parse(process.env.FICHAS_CLAUDE_CMD);
  return [acharClaude()];
}

function proximo() {
  if (ocupado || !fila.length) return;
  ocupado = true;
  const { c, prompt } = fila.shift();
  c.estado = 'trabalhando'; gravar();
  executar(c, prompt, () => { ocupado = false; c.atualizado = Date.now(); gravar(); proximo(); });
}

function executar(c, prompt, fim) {
  const [bin, ...base] = comandoClaude();
  const args = [...base, '-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
                '--allowedTools', FERRAMENTAS, '--append-system-prompt', PAPEL];
  if (c.sessao) args.push('--resume', c.sessao);

  const avisar = texto => c.historico.push({ quem: 'sistema', texto, quando: Date.now() });
  let saida = '', erros = '', feito = false, resultado = null;
  const concluir = () => { if (feito) return false; feito = true; c.estado = 'parada'; return true; };

  // sem shell: o texto vai pela entrada padrão e nunca vira comando
  const proc = spawn(bin, args, { cwd: PROJETO, env: process.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const prazo = setTimeout(() => {
    avisar('Demorou demais e foi interrompido. Confira a pasta e mande de novo se precisar.');
    try { proc.kill(); } catch (e) { /* já morreu */ }
  }, LIMITE_EXECUCAO);

  proc.stdin.on('error', () => { /* caiu antes de ler */ });
  proc.stdin.end(prompt, 'utf8');
  /* O claude pode terminar a resposta e o processo seguir aberto, preso a um
     terminal auxiliar. Por isso o fim vale pela linha "result" da saída, e não
     por o processo fechar: sem isso, a resposta nunca chega ao dono. */
  proc.stdout.on('data', d => {
    saida += d;
    let fimLinha;
    while ((fimLinha = saida.indexOf('\n')) >= 0) {
      const linha = saida.slice(0, fimLinha).trim();
      saida = saida.slice(fimLinha + 1);
      let o = null;
      try { o = JSON.parse(linha); } catch (e) { continue; }
      if (o && o.type === 'result') { resultado = o; encerrar(); }
    }
  });
  proc.stderr.on('data', d => { erros += d; });
  proc.on('error', e => {
    clearTimeout(prazo);
    if (concluir()) { avisar('Não consegui abrir o Claude: ' + e.message); fim(); }
  });
  proc.on('close', () => encerrar());

  function encerrar() {
    clearTimeout(prazo);
    if (!concluir()) return;
    // o que ficou preso a ele não serve mais: libera a fila e o processo
    if (resultado && proc.exitCode === null) {
      spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }).on('error', () => {});
    }
    const j = resultado;
    const texto = j ? String(j.result || '') : (erros || saida).trim();
    if (j && j.session_id && !/not logged in|\/login/i.test(texto)) c.sessao = j.session_id;
    if (/not logged in|please run \/login/i.test(texto)) avisar('O Claude não está conectado neste computador. Faça o login uma vez e mande de novo.');
    else if (texto) c.historico.push({ quem: 'agente', texto, quando: Date.now(), erro: !!(j && j.is_error) });
    else avisar('Ele terminou sem responder. Mande de novo.');
    fim();
  }
}

function criarConversa(b) {
  const cliente = limparNome(b.cliente).toUpperCase();
  if (!cliente) return { ok: false, motivo: 'diga o nome do cliente' };
  let c = conversas.find(x => x.cliente === cliente);
  if (!c) {
    c = { id: crypto.randomUUID(), cliente, sessao: null, estado: 'parada', historico: [], criado: Date.now(), atualizado: Date.now() };
    conversas.push(c);
    gravar();
  }
  return { ok: true, conversa: resumo(c) };
}

function mandar(c, b) {
  const texto = String(b.texto || '').trim().slice(0, 50000);
  const pasta = pastaAnexos(c);
  const anexos = (Array.isArray(b.anexos) ? b.anexos : []).map(n => limparNome(n, 150))
    .filter(n => n && fs.existsSync(path.join(pasta, n)));
  if (!texto && !anexos.length) return { ok: false, motivo: 'escreva algo ou anexe um arquivo' };
  if (c.estado !== 'parada') return { ok: false, motivo: 'ele ainda está trabalhando na mensagem anterior' };

  c.historico.push({ quem: 'voce', texto, anexos, quando: Date.now() });
  c.atualizado = Date.now();
  const partes = [`Cliente: ${c.cliente}`, texto];
  if (anexos.length) partes.push('Anexos desta mensagem (abra com a ferramenta Read):', ...anexos.map(n => '- ' + path.join(pasta, n)));
  c.estado = 'na fila';
  fila.push({ c, prompt: partes.filter(Boolean).join('\n') });
  gravar();
  proximo();
  return { ok: true };
}

function receberAnexo(req, res, c, nomeBruto) {
  const nome = limparNome(nomeBruto, 150);
  if (!nome) return json(res, 400, { ok: false, motivo: 'arquivo sem nome' });
  if (Number(req.headers['content-length']) > LIMITE_ARQUIVO) return json(res, 413, { ok: false, motivo: 'arquivo maior que 200 MB' });
  const pasta = pastaAnexos(c);
  fs.mkdirSync(pasta, { recursive: true });
  const { name, ext } = path.parse(nome);
  let final = nome;
  for (let n = 2; fs.existsSync(path.join(pasta, final)); n++) final = `${name} (${n})${ext}`;
  const arquivo = path.join(pasta, final);
  pipeline(req, fs.createWriteStream(arquivo), err => {
    if (err) {
      fs.rm(arquivo, { force: true }, () => {});
      if (!res.headersSent) json(res, 500, { ok: false, motivo: 'não consegui gravar ' + nome + ': ' + err.message });
      return;
    }
    json(res, 200, { ok: true, nome: final });
  });
}

/* ---------- login ---------- */
let cacheLogin = { quando: 0, dados: null };
function estadoLogin() {
  if (Date.now() - cacheLogin.quando < 15000 && cacheLogin.dados) return Promise.resolve(cacheLogin.dados);
  return new Promise(ok => {
    const fim = dados => { cacheLogin = { quando: Date.now(), dados }; ok(dados); };
    const [bin, ...base] = comandoClaude();
    let saida = '';
    const p = spawn(bin, [...base, 'auth', 'status'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const prazo = setTimeout(() => { try { p.kill(); } catch (e) {} }, 8000);
    p.stdout.on('data', d => { saida += d; });
    p.on('error', () => { clearTimeout(prazo); fim({ instalado: false, conectado: false }); });
    p.on('close', () => {
      clearTimeout(prazo);
      let j = null;
      try { j = JSON.parse(saida); } catch (e) { /* saída inesperada */ }
      fim({ instalado: !!j, conectado: !!(j && j.loggedIn) });
    });
  });
}

/* ---------- http ---------- */
function json(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

function origemOk(req) {
  const o = req.headers.origin;
  return !o || o === `http://localhost:${PORTA}` || o === `http://127.0.0.1:${PORTA}`;
}

function lerJson(req, res, feito) {
  let bruto = '';
  req.on('data', d => { bruto += d; if (bruto.length > LIMITE_JSON) req.destroy(); });
  req.on('end', () => {
    try { json(res, 200, feito(JSON.parse(bruto || '{}'))); }
    catch (e) { json(res, 500, { ok: false, motivo: e.message }); }
  });
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname;
  if (req.method !== 'GET' && !origemOk(req)) return json(res, 403, { ok: false, motivo: 'origem recusada' });

  if (rota === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  if (rota === '/api/login' && req.method === 'GET') return void estadoLogin().then(d => json(res, 200, d));
  if (rota === '/api/conversas' && req.method === 'GET') {
    return json(res, 200, { conversas: conversas.map(resumo).sort((a, b) => b.quando - a.quando) });
  }
  if (rota === '/api/conversas' && req.method === 'POST') return lerJson(req, res, criarConversa);

  const m = rota.match(/^\/api\/conversas\/([0-9a-f-]+)(?:\/(mensagem|anexo))?$/);
  if (m) {
    const c = conversas.find(x => x.id === m[1]);
    if (!c) return json(res, 404, { ok: false, motivo: 'conversa não encontrada' });
    if (!m[2] && req.method === 'GET') return json(res, 200, { cliente: c.cliente, estado: c.estado, historico: c.historico });
    if (m[2] === 'mensagem' && req.method === 'POST') return lerJson(req, res, b => mandar(c, b));
    if (m[2] === 'anexo' && req.method === 'PUT') return receberAnexo(req, res, c, url.searchParams.get('nome'));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
});

servidor.listen(PORTA, '127.0.0.1', () => console.log(`Agente ${EH_DESENHO ? 'Desenho' : 'Fichas'} em http://localhost:${PORTA}`));
