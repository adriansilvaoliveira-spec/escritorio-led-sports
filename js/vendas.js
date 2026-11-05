/* ===========================================================
   vendas.js — vendas do mês por vendedor, para o painel da parede.
   Vem de /api/vendas, que lê a lista do sistema de fichas
   (config.vendas em data/config.json).
   =========================================================== */
const VENDAS = (() => {
  let d = { mes: '', vendedores: [], total: 0, configurado: false, erro: null };
  async function atualizar() {
    try { d = await (await fetch('/api/vendas')).json(); } catch (e) { /* fora do ar: fica o último */ }
  }
  atualizar();
  setInterval(atualizar, 60000);
  return { dados: () => d, atualizar };
})();
