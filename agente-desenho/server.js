/* ===========================================================
   agente-desenho — o formulário de pedido do funcionário Desenho.

   Abre dentro do monitor dele no escritório. Lista os moldes que
   estão no Google Drive e grava cada pedido na pasta do cliente:

     ARTES\CLIENTES\<CLIENTE>\
       PEDIDO <data hora>.txt e .json, e os anexos em REFERENCIA\

   Também recebe alteração de arte pronta: copia o arquivo informado
   e nunca mexe no original. O molde e o mockup são feitos na conversa
   daquele cliente, para onde o pedido é entregue. Só precisa de Node.js.
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
const PASTAS_ANEXO = { desenho: 'REFERÊNCIA/DESENHO', logo: 'LOGO/ESCUDO', patrocinio: 'PATROCÍNIO' };
// as artes ficam na raiz do Drive (ARTES\CLIENTES), não dentro de DESENHO
const PASTA_ARTES = process.env.DESENHO_ARTES || path.join(RAIZ_PADRAO, 'ARTES', 'CLIENTES');
const pastaCliente = cliente => path.join(PASTA_ARTES, cliente);
const pastaReferencia = cliente => path.join(pastaCliente(cliente), 'REFERENCIA');
const ehCalcao = grupo => semAcento(grupo) === 'CALCAO';
const IGNORAR_MOLDE = /TESTE|C[óo]pia_de_seguran[çc]a/i;
const URL_CONVERSA = process.env.DESENHO_CONVERSA_URL || 'http://localhost:4404';
const EXT_ARTE = /\.(cdr|ai|eps|psd|psb|pdf|svg|jpe?g|png)$/i;
const EXT_EDITAVEL = /\.(cdr|ai|eps|psd|psb)$/i;
const MAX_DA_PASTA = 6;
const REPETIR_ENVIO_MS = 30 * 1000;
const LIMITE_REPETIR_MS = 60 * 60 * 1000;

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
  if (p.tipo === 'alteracao') return textoAlteracao(p);
  const c = p.cores || {}, d = p.detalhes || {}, n = d.numero || {};
  const simNao = v => v ? 'sim' : 'não';
  const linhas = [
    `PEDIDO DE DESENHO - ${p.cliente}`,
    `Recebido em: ${p.recebido}`,
    `Origem: ${p.origem}`,
    `Já é cliente da loja: ${simNao(p.clienteDaLoja)}`,
    '',
    `Modelo da camisa: ${p.modelo}`,
    `Mockup sugerido: ${p.mockup || 'nenhum encontrado no Drive - perguntar antes de seguir'}`,
    `Modelo do calção: ${p.calcao || 'o do kit / não informado'}`,
    `Time ou camisa de referência: ${d.referencia || '-'}`,
    '',
    `Cor principal: ${c.principal || '-'}`,
    `Cor secundária: ${c.secundaria || '-'}`,
    `Cor dos detalhes: ${c.detalhes || '-'}`,
    `Cor do calção: ${c.calcao || '-'}`,
    `Cor do meião: ${c.meiao || '-'}`,
    `Outras cores: ${c.outras || '-'}`,
    `Gola e punho: ${d.gola || '-'}`,
    '',
    `Fonte do número e do nome: ${d.fonte || 'escolher a que combina e avisar'}`,
    `Número: frente ${simNao(n.frente)}, costas ${simNao(n.costas)}, calção ${simNao(n.calcao)}`,
    `Nome nas costas: ${simNao(d.nomeCostas)}`,
    `Escudo ou mascote: ${d.escudo || '-'}`,
    `Patrocínios e onde vão: ${d.patrocinios || '-'}`,
    '',
    'Observações:',
    p.observacoes || '-',
    '',
    `Anexos (em ${pastaReferencia(p.cliente)}):`
  ];
  for (const t of Object.keys(PASTAS_ANEXO)) {
    const lista = (p.anexos && p.anexos[t]) || [];
    linhas.push(`  ${PASTAS_ANEXO[t]}: ${lista.length ? lista.join(', ') : '-'}`);
  }
  return linhas.join('\r\n') + '\r\n';
}

const pedidos = new Map();   // id -> { pasta, dados }

function gravarPedido(reg) {
  fs.writeFileSync(reg.arquivo + '.json', JSON.stringify(reg.dados, null, 2));
  // BOM para o Bloco de Notas acertar os acentos
  fs.writeFileSync(reg.arquivo + '.txt', '\ufeff' + textoPedido(reg.dados));
}

const texto = (v, lim = 200) => String(v || '').trim().slice(0, lim);

function criarPedido(b) {
  const cliente = limparNome(b.cliente).toUpperCase();
  const modelo = String(b.modelo || '').trim().slice(0, 120);
  const calcao = String(b.calcao || '').trim().slice(0, 120);
  if (!cliente) return { ok: false, motivo: 'diga o nome do cliente' };
  if (!modelo) return { ok: false, motivo: 'escolha o modelo' };
  const conhecido = modelos().find(m => m.nome === modelo);
  if (!conhecido) return { ok: false, motivo: 'esse modelo não está na pasta de moldes' };
  if (calcao && !modelos().some(m => m.nome === calcao && ehCalcao(m.grupo))) return { ok: false, motivo: 'esse calção não está na pasta de moldes' };
  const cores = {};
  for (const k of ['principal', 'secundaria', 'detalhes', 'calcao', 'meiao', 'outras']) cores[k] = texto((b.cores || {})[k]);
  const d = b.detalhes || {}, n = d.numero || {};
  const detalhes = {
    referencia: texto(d.referencia), gola: texto(d.gola), fonte: texto(d.fonte),
    escudo: texto(d.escudo), patrocinios: texto(d.patrocinios, 500),
    numero: { frente: n.frente === true, costas: n.costas === true, calcao: n.calcao === true },
    nomeCostas: d.nomeCostas === true
  };

  const pasta = pastaCliente(cliente);
  fs.mkdirSync(pastaReferencia(cliente), { recursive: true });
  let arquivo = path.join(pasta, 'PEDIDO ' + carimbo());
  for (let k = 2; fs.existsSync(arquivo + '.txt'); k++) arquivo = path.join(pasta, `PEDIDO ${carimbo()} (${k})`);

  const id = crypto.randomUUID();
  const reg = {
    pasta, arquivo,
    dados: {
      cliente, modelo, mockup: conhecido.mockup, calcao, cores, detalhes,
      clienteDaLoja: b.clienteDaLoja === true,
      observacoes: String(b.observacoes || '').slice(0, 5000),
      origem: 'escritório', recebido: new Date().toLocaleString('pt-BR'),
      anexos: { desenho: [], logo: [], patrocinio: [] }
    }
  };
  pedidos.set(id, reg);
  gravarPedido(reg);
  return { ok: true, id, pasta };
}

/* ---------- alteração de arte pronta ---------- */
function textoAlteracao(p) {
  const linhas = [
    `ALTERAÇÃO DE ARTE PRONTA - ${p.cliente}`,
    `Recebido em: ${p.recebido}`,
    `Origem: ${p.origem}`,
    '',
    'Arquivos informados (os originais não são alterados):',
    ...p.informados.map(c => '  ' + c),
    '',
    'Cópias para editar, na pasta ORIGINAL:',
    ...p.copias.map(c => '  ' + c),
    '',
    'O que alterar:',
    p.observacoes,
    '',
    'Anexos:'
  ];
  linhas.push(`  (em ${pastaReferencia(p.cliente)})`);
  for (const t of Object.keys(PASTAS_ANEXO)) {
    const lista = (p.anexos && p.anexos[t]) || [];
    linhas.push(`  ${PASTAS_ANEXO[t]}: ${lista.length ? lista.join(', ') : '-'}`);
  }
  return linhas.join('\r\n') + '\r\n';
}

/* aceita o que o "Copiar como caminho" do Windows entrega: arquivo ou pasta, com aspas */
function arquivosDoCaminho(texto) {
  const c = String(texto || '').trim().replace(/^["']+|["']+$/g, '');
  if (!c) return { lista: [] };
  if (!/^[A-Za-z]:\\/.test(c)) return { erro: `use o caminho completo, começando pela unidade (ex.: G:\\...): ${c}` };
  let info;
  try { info = fs.statSync(c); } catch (e) { return { erro: 'não encontrei: ' + c }; }
  if (info.isFile()) {
    if (!EXT_ARTE.test(c)) return { erro: 'esse tipo de arquivo não é de arte: ' + c };
    return { lista: [c] };
  }
  const lista = fs.readdirSync(c, { withFileTypes: true })
    .filter(d => d.isFile() && EXT_EDITAVEL.test(d.name) && !d.name.startsWith('~'))
    .map(d => path.join(c, d.name));
  if (!lista.length) return { erro: 'não achei CDR nem PSD nesta pasta: ' + c };
  if (lista.length > MAX_DA_PASTA) return { erro: `essa pasta tem ${lista.length} arquivos de arte. Informe o arquivo certo: ${c}` };
  return { lista };
}

async function criarAlteracao(b) {
  const cliente = limparNome(b.cliente).toUpperCase();
  const observacoes = String(b.observacoes || '').trim().slice(0, 5000);
  if (!cliente) return { ok: false, motivo: 'diga o nome do cliente' };
  if (!observacoes) return { ok: false, motivo: 'diga o que precisa alterar' };
  const informados = [];
  for (const campo of [b.molde, b.mockup]) {
    const r = arquivosDoCaminho(campo);
    if (r.erro) return { ok: false, motivo: r.erro };
    for (const c of r.lista) if (!informados.includes(c)) informados.push(c);
  }
  if (!informados.length) return { ok: false, motivo: 'informe onde está o molde ou o mockup' };

  let pasta = path.join(pastaCliente(cliente), 'ALTERACAO ' + carimbo());
  for (let n = 2; fs.existsSync(pasta); n++) pasta = path.join(pastaCliente(cliente), `ALTERACAO ${carimbo()} (${n})`);
  const original = path.join(pasta, 'ORIGINAL');
  fs.mkdirSync(original, { recursive: true });
  fs.mkdirSync(pastaReferencia(cliente), { recursive: true });

  // só lê o arquivo de origem: vale também para a pasta de produção, que é só para ver
  const copias = [];
  for (const c of informados) {
    const destino = path.join(original, nomeLivre(original, path.basename(c)));
    await fs.promises.copyFile(c, destino, fs.constants.COPYFILE_EXCL);
    copias.push(destino);
  }
  const id = crypto.randomUUID();
  const reg = {
    pasta, arquivo: path.join(pasta, 'PEDIDO'),
    dados: {
      tipo: 'alteracao', cliente, informados, copias, observacoes,
      origem: 'escritório', recebido: new Date().toLocaleString('pt-BR'),
      anexos: { desenho: [], logo: [], patrocinio: [] }
    }
  };
  pedidos.set(id, reg);
  gravarPedido(reg);
  return { ok: true, id, pasta };
}

/* ---------- entrega o pedido à conversa do cliente no funcionário Desenho ---------- */
function mensagemParaDesenho(reg) {
  const pedido = reg.arquivo + '.txt';
  const ref = pastaReferencia(reg.dados.cliente);
  if (reg.dados.tipo === 'alteracao') {
    return [
      `ALTERAÇÃO de arte pronta, pedida pelo escritório. Leia ${pedido}; os anexos estão em ${ref}.`,
      `Edite só as cópias da pasta ORIGINAL, e salve o resultado em ${reg.pasta}. Nunca mexa nos arquivos de origem.`,
      'Mude apenas o que foi pedido e mantenha todo o resto igual. Se veio molde, altere o molde primeiro, exporte a prévia, escreva o caminho completo dela e espere a aprovação antes de atualizar o mockup. Se veio só o mockup, altere e mostre a prévia do mesmo jeito.'
    ].join('\n');
  }
  return [
    `Novo pedido de desenho, feito pelo escritório. Leia ${pedido}: ele já traz tudo o que o dono informou. Liste ${ref} e use os logos de lá direto.`,
    `Siga a memória receita-arte-led e trabalhe em ${reg.pasta}. Fluxo: molde, prévia com o caminho completo, e PARE esperando a aprovação antes do mockup.`
  ].join('\n');
}

async function postarConversa(rota, corpo) {
  const r = await fetch(URL_CONVERSA + rota, { method: 'POST', body: JSON.stringify(corpo) });
  return r.json();
}

async function entregar(reg) {
  try {
    const c = await postarConversa('/api/conversas', { cliente: reg.dados.cliente });
    if (!c.ok) return { enviado: false, motivo: c.motivo };
    const texto = mensagemParaDesenho(reg);
    const r = await postarConversa(`/api/conversas/${c.conversa.id}/mensagem`, { texto });
    if (r.ok) return { enviado: true, conversa: c.conversa.id };
    // já trabalhando nesse cliente: entrega assim que ele terminar
    const inicio = Date.now();
    const repetir = setInterval(async () => {
      if (Date.now() - inicio > LIMITE_REPETIR_MS) return clearInterval(repetir);
      try {
        const de = await postarConversa(`/api/conversas/${c.conversa.id}/mensagem`, { texto });
        if (de.ok) clearInterval(repetir);
      } catch (e) { /* tenta de novo na próxima */ }
    }, REPETIR_ENVIO_MS);
    return { enviado: true, conversa: c.conversa.id, naFila: true };
  } catch (e) {
    return { enviado: false, motivo: 'o funcionário Desenho está desligado' };
  }
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

  // tudo o que o dono manda vai para REFERENCIA, onde o Desenho sempre procura
  const destino = pastaReferencia(reg.dados.cliente);
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
  if (rota === '/api/alteracao' && req.method === 'POST') {
    let bruto = '';
    req.on('data', c => { bruto += c; if (bruto.length > LIMITE_JSON) req.destroy(); });
    req.on('end', () => {
      let b;
      try { b = JSON.parse(bruto || '{}'); } catch (e) { return json(res, 400, { ok: false, motivo: 'pedido inválido' }); }
      criarAlteracao(b).then(r => json(res, 200, r)).catch(e => json(res, 500, { ok: false, motivo: e.message }));
    });
    return;
  }
  const mf = rota.match(/^\/api\/pedido\/([0-9a-f-]+)\/fim$/);
  if (mf && req.method === 'POST') {
    const reg = pedidos.get(mf[1]);
    if (!reg) return json(res, 404, { ok: false, motivo: 'pedido não encontrado' });
    return void entregar(reg).then(r => json(res, 200, { ok: true, ...r }));
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
