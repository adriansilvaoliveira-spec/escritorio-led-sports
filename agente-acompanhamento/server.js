/* ===========================================================
   agente-acompanhamento — o funcionário que não deixa nada esquecido.

   Lê, sem mexer, o Kanban do atendente (3300/painel/api/quadro) e as
   conversas (dados/conversas.json), e avisa o dono pela assessoria:
     - cliente que escreveu e está sem resposta há mais de 30 min (na hora);
     - pedido de ajuda da IA ainda aberto;
     - card parado (desenho, arte enviada, fechar pedido, pagamento).
   Resumo às 9h, 13h e 16h30, de segunda a sábado, só se houver algo.

   Não usa IA, não responde cliente e não altera o atendente nem os
   agentes do Fábio e do Juninho. As chaves vêm do .env do atendente,
   lido pelo próprio config.js dele: nada de segredo aqui.
   =========================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = Number(process.env.PORT) || 4406;
const ATENDENTE = process.env.ATENDENTE_PASTA || 'C:\\LED-atendente\\atendente';
const QUADRO = process.env.QUADRO_URL || 'http://localhost:3300/painel/api/quadro';
const DADOS = path.join(__dirname, 'dados');
const ESTADO = path.join(DADOS, 'estado.json');

const MIN = 60 * 1000, HORA = 60 * MIN, DIA = 24 * HORA;
const SEM_RESPOSTA = 30 * MIN;           // cliente esperando mais que isso vira aviso
const JANELA_CONVERSA = 7 * DIA;         // conversa mais velha que isso não entra em "sem resposta"
const PARADO = { desenho: 2 * DIA, aprov: 2 * DIA, fechar: 2 * DIA, fechado: 1 * DIA };
// O dono só quer saber de problema (12/11): sem resumos automáticos; o botão da tela ainda manda um.
const RESUMOS = [];
const FORA = new Set(['nao_fechou', 'entregue', 'producao', 'pronto']);

const { env } = require(path.join(ATENDENTE, 'src', 'config'));
const { criarCliente } = require(path.join(ATENDENTE, 'src', 'whatsapp'));

/* ---------- estado: o que já foi avisado ---------- */
let estado = { avisados: {}, resumos: {}, ultimo: null, log: [] };
try { estado = { ...estado, ...JSON.parse(fs.readFileSync(ESTADO, 'utf8')) }; } catch (e) { /* primeira vez */ }
function gravar() {
  fs.mkdirSync(DADOS, { recursive: true });
  fs.writeFileSync(ESTADO + '.tmp', JSON.stringify(estado, null, 2));
  fs.renameSync(ESTADO + '.tmp', ESTADO);
}
function anotar(t) {
  const linha = `[${new Date().toLocaleString('pt-BR')}] ${t}`;
  console.log(linha); estado.log = [linha, ...estado.log].slice(0, 60);
}

/* ---------- leitura ---------- */
const soDigitos = n => String(n || '').replace(/\D/g, '');
const mesmoNumero = (a, b) => { a = soDigitos(a); b = soDigitos(b); return !!a && !!b && a.slice(-8) === b.slice(-8); };
function daCasa(numero) {
  const e = env();
  return [e.DONO_WHATSAPP, ...String(e.EQUIPE_WHATSAPP || '').split(',')].some(n => mesmoNumero(n, numero));
}

async function lerQuadro() {
  const r = await fetch(QUADRO);
  if (!r.ok) throw new Error('quadro respondeu ' + r.status);
  return r.json();
}
function lerConversas() {
  const bruto = JSON.parse(fs.readFileSync(path.join(ATENDENTE, 'dados', 'conversas.json'), 'utf8'));
  return Array.isArray(bruto) ? bruto : Object.values(bruto);
}

const quanto = ms => ms >= DIA ? `${Math.floor(ms / DIA)}d` : ms >= HORA ? `${Math.floor(ms / HORA)}h` : `${Math.max(1, Math.round(ms / MIN))} min`;
const quem = c => [c.nome || c.nome_perfil || ('…' + soDigitos(c.id).slice(-4)), c.time ? `(${c.time})` : ''].join(' ').trim();

async function pendencias(agora = Date.now()) {
  const q = await lerQuadro();
  const nomeEtapa = Object.fromEntries(q.etapas.map(e => [e.id, e.nome]));
  const cards = Object.fromEntries(q.cards.map(c => [c.id, c]));
  const semResposta = [], ajuda = [], parados = [];

  for (const c of lerConversas()) {
    if (daCasa(c.id) || FORA.has(c.etapa) || /^LED SPORTS/i.test(c.nome_perfil || '')) continue;
    const cli = c.ultima_cliente || 0, loja = c.ultima_loja || 0;
    // conversa pausada é o dono atendendo pelo celular: não é problema da IA, não avisa
    if (!c.pausada && cli && cli > loja && agora - cli > SEM_RESPOSTA && agora - cli < JANELA_CONVERSA)
      semResposta.push({ id: c.id, desde: cli, texto: `${quem({ ...c, ...(cards[c.id] || {}) })} há ${quanto(agora - cli)}${c.pausada ? ' (pausada, com você)' : ''}` });
  }
  for (const c of q.cards) {
    if (daCasa(c.id) || FORA.has(c.etapa)) continue;
    for (const a of c.avisos || []) if (a.tipo === 'ajuda') ajuda.push({ id: c.id, texto: `${quem(c)}: ${String(a.motivo || '').slice(0, 120)}` });
    const lim = PARADO[c.etapa];
    if (lim && agora - c.desde > lim) parados.push({ id: c.id, texto: `${quem(c)} em ${nomeEtapa[c.etapa] || c.etapa} há ${quanto(agora - c.desde)}` });
  }
  semResposta.sort((a, b) => a.desde - b.desde);
  return { semResposta, ajuda, parados, quando: agora };
}

function montar(p, titulo) {
  const bloco = (nome, lista, max = 8) => !lista.length ? '' :
    `\n*${nome}* (${lista.length})\n` + lista.slice(0, max).map(x => '• ' + x.texto).join('\n') + (lista.length > max ? `\n• e mais ${lista.length - max}` : '');
  return (titulo + bloco('Sem resposta', p.semResposta) + bloco('Pedido de ajuda aberto', p.ajuda, 6) + bloco('Parado', p.parados, 6)).trim();
}

/* ---------- envio ao dono (assessoria; sem ela, número da LED) ---------- */
async function mandarAoDono(texto) {
  const e = env();
  if (!e.DONO_WHATSAPP) throw new Error('falta DONO_WHATSAPP no .env do atendente');
  const assessoria = e.ASSESSORA_TOKEN && e.ASSESSORA_PHONE_NUMBER_ID;
  const wa = assessoria
    ? criarCliente({ token: e.ASSESSORA_TOKEN, phoneNumberId: e.ASSESSORA_PHONE_NUMBER_ID, versao: e.GRAPH_VERSION || 'v26.0' })
    : criarCliente({ token: e.WHATSAPP_TOKEN, phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID, versao: e.GRAPH_VERSION || 'v26.0', base: e.WHATSAPP_API_BASE });
  try { return await wa.enviarTexto(e.DONO_WHATSAPP, texto); }
  catch (err) {
    // fora da janela de 24h da Meta só vai pelo modelo aprovado, como no atendente
    if (!e.DONO_MODELO || !/131047|24 ?h|re-?engage/i.test(err.message)) throw err;
    return wa.enviarModelo(e.DONO_WHATSAPP, e.DONO_MODELO, e.DONO_MODELO_IDIOMA || 'pt_BR', [String(texto).replace(/\s+/g, ' ').trim().slice(0, 900)]);
  }
}

/* ---------- rotina ---------- */
const expediente = d => d.getDay() !== 0 && d.getHours() >= 9 && d.getHours() < 18;

async function rodar() {
  const agora = new Date();
  let p;
  try { p = await pendencias(agora.getTime()); } catch (e) { anotar('não li o Kanban: ' + e.message); return; }
  estado.ultimo = p;

  // na hora: cliente novo sem resposta (uma vez por mensagem do cliente)
  if (expediente(agora)) {
    const novos = p.semResposta.filter(x => estado.avisados[x.id] !== x.desde);
    if (novos.length) {
      try {
        await mandarAoDono(montar({ semResposta: novos, ajuda: [], parados: [] }, '⏰ Cliente esperando resposta'));
        for (const x of novos) estado.avisados[x.id] = x.desde;
        anotar(`avisei ${novos.length} sem resposta`);
      } catch (e) { anotar('não consegui avisar: ' + e.message); }
    }
  }

  // resumos do dia
  const hoje = agora.toISOString().slice(0, 10);
  for (const [h, m] of RESUMOS) {
    const chave = `${hoje} ${h}:${m}`;
    const passou = agora.getHours() > h || (agora.getHours() === h && agora.getMinutes() >= m);
    if (agora.getDay() === 0 || !passou || estado.resumos[chave] || agora.getHours() > h + 1) continue;
    estado.resumos[chave] = true;
    if (!p.semResposta.length && !p.ajuda.length && !p.parados.length) { anotar('resumo ' + chave + ': nada pendente'); continue; }
    try { await mandarAoDono(montar(p, `📋 Pendências ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)); anotar('resumo enviado ' + chave); }
    catch (e) { anotar('resumo não foi: ' + e.message); }
  }
  // limpa marcas velhas
  for (const k of Object.keys(estado.resumos)) if (k.slice(0, 10) < hoje) delete estado.resumos[k];
  gravar();
}

/* ---------- tela ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function pagina() {
  const p = estado.ultimo;
  const lista = (nome, l) => `<h2>${nome} <small>${l.length}</small></h2>` + (l.length ? '<ul>' + l.map(x => `<li>${esc(x.texto)}</li>`).join('') + '</ul>' : '<p class="ok">Nada.</p>');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acompanhamento</title>
<style>body{font:15px system-ui,sans-serif;background:#10141c;color:#e6e9ef;margin:0;padding:16px;max-width:820px}h1{font-size:20px}h2{font-size:16px;margin:18px 0 6px}small{color:#8b93a7}li{margin:3px 0}.ok{color:#6ee7a0}button{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer}pre{color:#8b93a7;font-size:12px;white-space:pre-wrap}</style></head><body>
<h1>Acompanhamento</h1><p><small>Confere a cada 10 min. Avisa você pela assessoria: só quando um cliente fica sem resposta da IA (conversa pausada não conta).${p ? ' Última conferência: ' + new Date(p.quando).toLocaleString('pt-BR') : ''}</small></p>
<button onclick="fetch('/api/resumo',{method:'POST'}).then(r=>r.json()).then(j=>alert(j.ok?'Resumo enviado':'Não foi: '+j.motivo))">Mandar resumo agora</button>
${p ? lista('Sem resposta', p.semResposta) + lista('Pedido de ajuda aberto', p.ajuda) + lista('Parado', p.parados) : '<p>Ainda conferindo…</p>'}
<h2>Registro</h2><pre>${esc(estado.log.slice(0, 20).join('\n'))}</pre></body></html>`;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (s, d) => res.writeHead(s, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(d));
  if (req.method === 'GET' && url.pathname === '/') return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(pagina());
  if (req.method === 'GET' && url.pathname === '/api/pendencias') {
    try { return json(200, await pendencias()); } catch (e) { return json(502, { motivo: e.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/resumo') {
    const o = req.headers.origin;
    if (o && o !== `http://localhost:${PORTA}` && o !== `http://127.0.0.1:${PORTA}`) return json(403, { ok: false, motivo: 'origem recusada' });
    try {
      const p = await pendencias(); estado.ultimo = p;
      await mandarAoDono(montar(p, '📋 Pendências agora') || 'Nada pendente.'); anotar('resumo pedido na tela'); gravar();
      return json(200, { ok: true });
    } catch (e) { return json(502, { ok: false, motivo: e.message }); }
  }
  json(404, { motivo: 'não existe' });
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`Acompanhamento em http://localhost:${PORTA}`);
  // primeira volta não dispara aviso de tudo que já estava esperando: só marca
  if (!estado.ultimo) pendencias().then(p => { for (const x of p.semResposta) estado.avisados[x.id] = x.desde; estado.ultimo = p; gravar(); }).catch(() => {}).finally(() => setInterval(rodar, 10 * MIN));
  else { rodar(); setInterval(rodar, 10 * MIN); }
});
