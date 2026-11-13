/* Avisa o dono (pela assessoria do atendente) quando o Claude dos funcionários
   Fichas/Desenho/Mockup fica sem login: sem isso eles param calados (13/11).
   Confere a cada 30 min; repete o aviso no máximo a cada 6 h enquanto durar. */
const path = require('path');

const ATENDENTE = process.env.ATENDENTE_PASTA || 'C:\\LED-atendente\\atendente';
const PORTAS = [4403, 4404, 4405];
const CADA = 30 * 60 * 1000, REPETE = 6 * 60 * 60 * 1000;
let ultimoAviso = 0;

async function mandarAoDono(texto) {
  const { env } = require(path.join(ATENDENTE, 'src', 'config'));
  const { criarCliente } = require(path.join(ATENDENTE, 'src', 'whatsapp'));
  const e = env();
  if (!e.DONO_WHATSAPP) throw new Error('falta DONO_WHATSAPP no .env do atendente');
  const wa = e.ASSESSORA_TOKEN && e.ASSESSORA_PHONE_NUMBER_ID
    ? criarCliente({ token: e.ASSESSORA_TOKEN, phoneNumberId: e.ASSESSORA_PHONE_NUMBER_ID, versao: e.GRAPH_VERSION || 'v26.0' })
    : criarCliente({ token: e.WHATSAPP_TOKEN, phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID, versao: e.GRAPH_VERSION || 'v26.0', base: e.WHATSAPP_API_BASE });
  try { return await wa.enviarTexto(e.DONO_WHATSAPP, texto); }
  catch (err) {
    if (!e.DONO_MODELO || !/131047|24 ?h|re-?engage/i.test(err.message)) throw err;
    return wa.enviarModelo(e.DONO_WHATSAPP, e.DONO_MODELO, e.DONO_MODELO_IDIOMA || 'pt_BR', [texto.replace(/\s+/g, ' ').trim()]);
  }
}

async function conferir() {
  for (const porta of PORTAS) {
    let j;
    try { j = await (await fetch(`http://localhost:${porta}/api/login`)).json(); }
    catch (e) { continue; }                       // desligado: o vigia cuida
    if (!j.instalado || j.conectado) continue;
    if (Date.now() - ultimoAviso < REPETE) return;
    ultimoAviso = Date.now();
    console.log('  aviso-login: funcionários sem login do Claude, avisando o dono');
    await mandarAoDono('⚠️ Os funcionários Fichas/Desenho/Mockup do escritório ficaram sem login do Claude e pararam. Peça ao Claude para refazer a chave (claude setup-token).')
      .catch(e => console.log('  aviso-login: não consegui avisar: ' + e.message));
    return;
  }
}

function iniciar() { setTimeout(conferir, 2 * 60 * 1000); setInterval(conferir, CADA); }

module.exports = { iniciar, conferir };
