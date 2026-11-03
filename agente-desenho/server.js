/* ===========================================================
   agente-desenho — o formulário de pedido do funcionário Desenho.

   Abre dentro do monitor dele no escritório. Lista os moldes que
   estão no Google Drive e grava cada pedido na pasta do cliente:

     ARTES\CLIENTES\<CLIENTE>\PEDIDO <data hora>\
       PEDIDO.txt, pedido.json, DESENHO\, LOGO\, PATROCINIO\

   Só grava pedido e anexos. O molde e o mockup são feitos depois,
   na conversa daquele cliente. Sem dependências: só Node.js.
   =========================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream');

const PORTA = Number(process.env.PORT) || 4402;
const RAIZ_PADRAO = process.env.DESENHO_RAIZ || 'G:\\Meu Drive\\AUTOMAÇÃO LEDSPORTS ATIBAIA';
const LIMITE_ARQUIVO = 500 * 1024 * 1024;
const LIMITE_JSON = 100 * 1024;
const CACHE_MODELOS_MS = 60 * 1000;
const PASTAS_ANEXO = { desenho: 'DESENHO', logo: 'LOGO', patrocinio: 'PATROCINIO' };
const IGNORAR_MOLDE = /TESTE|C[óo]pia_de_seguran[çc]a/i;

/* a pasta do Drive pode ganhar uma subpasta DESENHO: acha em vez de presumir */
function raiz() {
  try {
    const sub = fs.readdirSync(RAIZ_PADRAO, { withFileTypes: true })
      .find(d => d.isDirectory() && /^desenhos?$/i.test(d.name));
    if (sub) return path.join(RAIZ_PADRAO, sub.name);
  } catch (e) { /* Drive fora do ar: quem usar a pasta avisa */ }
  return RAIZ_PADRAO;
}

/* tira o que o Windows não aceita em nome de pasta e impede subir de nível */
function limparNome(texto, limite = 80) {
  return String(texto || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, limite)
    .trim();
}

const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const chaveModelo = nome => semAcento(path.parse(nome).name)
  .split(' - ')[0]
  .replace(/\b(MODELO|KIT)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function moldesEm(pasta, grupo, saida) {
  for (const d of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (d.isDirectory()) moldesEm(path.join(pasta, d.name), grupo || d.name, saida);
    else if (/\.cdr$/i.test(d.name) && !IGNORAR_MOLDE.test(d.name) && !d.name.startsWith('~')) {
      saida.push({ nome: path.parse(d.name).name, grupo: grupo || 'OUTROS', arquivo: path.join(pasta, d.name) });
    }
  }
  return saida;
}

let cacheModelos = null;
function modelos() {
  if (cacheModelos && Date.now() - cacheModelos.quando < CACHE_MODELOS_MS) return cacheModelos.dados;
  const r = raiz();
  const mockups = fs.readdirSync(path.join(r, 'BASE MOCKUPS'))
    .filter(n => /\.psd$/i.test(n) && !n.startsWith('~'))
    .map(n => ({ arquivo: n, chave: chaveModelo(n) }))
    // o nome mais comprido ganha: "CITY FEM" antes de "CITY"
    .sort((a, b) => b.chave.length - a.chave.length);
  const lista = moldesEm(path.join(r, 'MOLDE DE COSTURA'), null, []).map(m => {
    const k = chaveModelo(m.nome);
    const achou = mockups.find(x => x.chave === k || k.startsWith(x.chave + ' '));
    return { nome: m.nome, grupo: m.grupo, mockup: achou ? achou.arquivo : null };
  }).sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
  cacheModelos = { quando: Date.now(), dados: lista };
  return lista;
}

const carimbo = () => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}h${p(d.getMinutes())}`;
};

function textoPedido(p) {
  const c = p.cores || {};
  const linhas = [
    `PEDIDO DE DESENHO - ${p.cliente}`,
    `Recebido em: ${p.recebido}`,
    `Origem: ${p.origem}`,
    '',
    `Modelo: ${p.modelo}`,
    `Mockup sugerido: ${p.mockup || 'nenhum encontrado no Drive - perguntar antes de seguir'}`,
    '',
    `Cor principal: ${c.principal || '-'}`,
    `Cor secundária: ${c.secundaria || '-'}`,
    `Cor dos detalhes: ${c.detalhes || '-'}`,
    `Outras cores: ${c.outras || '-'}`,
    '',
    'Observações:',
    p.observacoes || '-',
    '',
    'Anexos:'
  ];
  for (const t of Object.keys(PASTAS_ANEXO)) {
    const lista = (p.anexos && p.anexos[t]) || [];
    linhas.push(`  ${PASTAS_ANEXO[t]}: ${lista.length ? lista.join(', ') : '-'}`);
  }
  return linhas.join('\r\n') + '\r\n';
}

const pedidos = new Map();   // id -> { pasta, dados }

function gravarPedido(reg) {
  fs.writeFileSync(path.join(reg.pasta, 'pedido.json'), JSON.stringify(reg.dados, null, 2));
  // BOM para o Bloco de Notas acertar os acentos
  fs.writeFileSync(path.join(reg.pasta, 'PEDIDO.txt'), '\ufeff' + textoPedido(reg.dados));
}

function criarPedido(b) {
  const cliente = limparNome(b.cliente).toUpperCase();
  const modelo = String(b.modelo || '').trim().slice(0, 120);
  if (!cliente) return { ok: false, motivo: 'diga o nome do cliente' };
  if (!modelo) return { ok: false, motivo: 'escolha o modelo' };
  const conhecido = modelos().find(m => m.nome === modelo);
  if (!conhecido) return { ok: false, motivo: 'esse modelo não está na pasta de moldes' };
  const cores = {};
  for (const k of ['principal', 'secundaria', 'detalhes', 'outras']) cores[k] = String((b.cores || {})[k] || '').slice(0, 200);

  const pastaCliente = path.join(raiz(), 'ARTES', 'CLIENTES', cliente);
  let pasta = path.join(pastaCliente, 'PEDIDO ' + carimbo());
  for (let n = 2; fs.existsSync(pasta); n++) pasta = path.join(pastaCliente, `PEDIDO ${carimbo()} (${n})`);
  fs.mkdirSync(pasta, { recursive: true });

  const id = crypto.randomUUID();
  const reg = {
    pasta,
    dados: {
      cliente, modelo, mockup: conhecido.mockup, cores,
      observacoes: String(b.observacoes || '').slice(0, 5000),
      origem: 'escritório', recebido: new Date().toLocaleString('pt-BR'),
      anexos: { desenho: [], logo: [], patrocinio: [] }
    }
  };
  pedidos.set(id, reg);
  gravarPedido(reg);
  return { ok: true, id, pasta };
}

function nomeLivre(pasta, nome) {
  const { name, ext } = path.parse(nome);
  let final = nome;
  for (let n = 2; fs.existsSync(path.join(pasta, final)); n++) final = `${name} (${n})${ext}`;
  return final;
}

function receberArquivo(req, res, reg, tipo, nomeBruto) {
  const nome = limparNome(nomeBruto, 150);
  if (!PASTAS_ANEXO[tipo]) return json(res, 400, { ok: false, motivo: 'tipo de anexo desconhecido' });
  if (!nome) return json(res, 400, { ok: false, motivo: 'arquivo sem nome' });
  if (Number(req.headers['content-length']) > LIMITE_ARQUIVO) return json(res, 413, { ok: false, motivo: 'arquivo maior que 500 MB' });

  const destino = path.join(reg.pasta, PASTAS_ANEXO[tipo]);
  fs.mkdirSync(destino, { recursive: true });
  const final = nomeLivre(destino, nome);
  const arquivo = path.join(destino, final);
  pipeline(req, fs.createWriteStream(arquivo), err => {
    if (err) {
      fs.rm(arquivo, { force: true }, () => {});
      if (!res.headersSent) json(res, 500, { ok: false, motivo: 'não consegui gravar ' + nome + ': ' + err.message });
      return;
    }
    reg.dados.anexos[tipo].push(final);
    gravarPedido(reg);
    json(res, 200, { ok: true, nome: final });
  });
}

function json(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

/* outro site aberto no navegador não pode gravar pedido aqui */
function origemOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  return o === `http://localhost:${PORTA}` || o === `http://127.0.0.1:${PORTA}`;
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = url.pathname;

  if (req.method !== 'GET' && !origemOk(req)) return json(res, 403, { ok: false, motivo: 'origem recusada' });

  if (rota === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  if (rota === '/api/modelos' && req.method === 'GET') {
    try { return json(res, 200, { ok: true, modelos: modelos() }); }
    catch (e) { return json(res, 503, { ok: false, motivo: 'não consegui ler o Google Drive: ' + e.message }); }
  }
  if (rota === '/api/pedido' && req.method === 'POST') {
    let bruto = '';
    req.on('data', c => { bruto += c; if (bruto.length > LIMITE_JSON) req.destroy(); });
    req.on('end', () => {
      try { json(res, 200, criarPedido(JSON.parse(bruto || '{}'))); }
      catch (e) { json(res, 500, { ok: false, motivo: e.message }); }
    });
    return;
  }
  const m = rota.match(/^\/api\/pedido\/([0-9a-f-]+)\/arquivo$/);
  if (m && req.method === 'PUT') {
    const reg = pedidos.get(m[1]);
    if (!reg) return json(res, 404, { ok: false, motivo: 'pedido não encontrado' });
    return receberArquivo(req, res, reg, url.searchParams.get('tipo'), url.searchParams.get('nome'));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
});

servidor.listen(PORTA, '127.0.0.1', () => console.log(`Agente Desenho em http://localhost:${PORTA} | Drive: ${raiz()}`));
