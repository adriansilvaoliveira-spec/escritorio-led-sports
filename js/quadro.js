/* ===========================================================
   quadro.js — ideias e agenda que aparecem nas paredes da Diretoria.
   Moram no disco (/api/quadro, data/quadro.json), para aparecerem
   iguais em qualquer navegador; o localStorage é só a cópia para
   quando o servidor estiver fora. Na primeira vez, o que já estava
   neste navegador sobe para o disco.
   =========================================================== */
const QUADRO = (() => {
  const K = 'escritorio-quadro-v1';
  let q = null;
  try { q = JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { /* storage bloqueado */ }
  if (!q || !Array.isArray(q.ideias) || !Array.isArray(q.eventos)) q = { ideias: [], eventos: [] };
  const local = () => { try { localStorage.setItem(K, JSON.stringify(q)); } catch (e) {} };
  const salvar = () => {
    local();
    fetch('/api/quadro', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) })
      .catch(() => { /* fora do ar: fica no navegador */ });
  };

  (async () => {
    try {
      const d = await (await fetch('/api/quadro')).json();
      if (d.vazio) { if (q.ideias.length || q.eventos.length) salvar(); return; }
      q = { ideias: d.ideias, eventos: d.eventos };
      local();
    } catch (e) { /* fora do ar: vale o do navegador */ }
  })();

  return {
    ideias:  () => q.ideias.slice(),
    eventos: () => q.eventos.slice(),
    addIdeia(t) {
      q.ideias.unshift(String(t).slice(0, 52));
      q.ideias = q.ideias.slice(0, 6); salvar();
    },
    delIdeia(i) { q.ideias.splice(i, 1); salvar(); },
    addEvento(e) {
      q.eventos.push({ data: String(e.data).slice(0, 8), nome: String(e.nome).slice(0, 34), tipo: String(e.tipo || 'Evento').slice(0, 16) });
      q.eventos = q.eventos.slice(0, 6); salvar();
    },
    delEvento(i) { q.eventos.splice(i, 1); salvar(); }
  };
})();
