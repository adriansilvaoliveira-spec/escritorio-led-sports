/* Acha o Claude Code desta máquina. Ele pode estar em ~/.local/bin, vir junto
   com o app Claude (a pasta muda a cada atualização, por isso vale a mais nova)
   ou estar no PATH. */
const fs = require('fs');
const path = require('path');

function doApp(casa) {
  const raiz = path.join(casa, 'AppData', 'Local', 'Claude-Data');
  const achados = [];
  const filhos = d => { try { return fs.readdirSync(d); } catch (e) { return []; } };
  for (const conta of filhos(raiz)) {
    const base = path.join(raiz, conta, 'claude-code');
    for (const versao of filhos(base)) {
      for (const hash of filhos(path.join(base, versao))) {
        const exe = path.join(base, versao, hash, 'claude.exe');
        try { achados.push({ exe, quando: fs.statSync(exe).mtimeMs }); } catch (e) { /* sem exe aqui */ }
      }
    }
  }
  achados.sort((a, b) => b.quando - a.quando);
  return achados.length ? achados[0].exe : null;
}

function acharClaude() {
  const casa = process.env.USERPROFILE || process.env.HOME || '';
  for (const t of [path.join(casa, '.local', 'bin', 'claude.exe'), path.join(casa, '.local', 'bin', 'claude')]) {
    if (t && fs.existsSync(t)) return t;
  }
  return doApp(casa) || (process.platform === 'win32' ? 'claude.exe' : 'claude');   // deixa o PATH resolver
}

module.exports = { acharClaude };
