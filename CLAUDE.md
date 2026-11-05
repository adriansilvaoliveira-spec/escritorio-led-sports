# Escritório de Agentes — LED SPORTS ATIBAIA

Instalação do [a2labsnutrition/Escritorio-de-agentes](https://github.com/a2labsnutrition/Escritorio-de-agentes)
para a LED SPORTS ATIBAIA. Repositório no GitHub: `escritorio-led-sports` (público), branch `main`.

## Regra: toda atualização vai para o GitHub

Depois de qualquer mudança nos arquivos deste projeto: `git add -A`, commit com
mensagem em português dizendo o que mudou, e `git push`. Não deixe mudança só local.

- `data/*.json` (exceto os `*.exemplo.json`) fica fora do git de propósito: tem
  configuração, equipe e a chave do CallMeBot. O repositório é público — nunca
  versionar segredos.
- `agente-desenho/`: formulário do funcionário Desenho (porta 4402), com novo desenho e alteração de
  arte pronta. Grava em `DESENHO\ARTES\CLIENTES\<CLIENTE>` no Google Drive e entrega à conversa do
  cliente; dados de cliente nunca entram no git.
- `agente-fichas/`: conversa por cliente, com anexos, dos funcionários Fichas (porta 4403) e Desenho
  (`AGENTE=desenho`, porta 4404). O cadastro deles está em `data/sistemas.json`. Pelo WhatsApp só o
  Fichas recebe pedido ("Ficha TIME"); desenho é feito direto no Claude.
- Painel VENDAS do mês (parede norte da Sala de Serviço, `js/vendas.js` + `/api/vendas`): só lê
  `config.vendas.arquivo` (neste PC, `C:\LED-atendente\app\vendas.json`, que o programa de fichas
  e o atendente do WhatsApp gravam) e soma o mês por vendedor (FÁBIO, JUNINHO).
- Tudo que gera ficha tem de gravar nessa lista, senão a venda não conta: o agente de fichas do
  Fábio e o do Juninho dentro do atendente (3300), a telinha `programa-fichas` (3210) e o Fichas
  (4403, com `FICHAS_PROJETO=C:\LED-atendente`). A cópia antiga em `Desktop\sistema automação wpp`
  não grava vendas: não apontar nada para ela.
- VENDAS FABIO é tipo `web` (3300/painel): o escritório nunca liga nem desliga o atendente, que
  roda à parte e só pode rodar em um computador por vez. VENDAS JUNINHO abre o `programa-fichas`.
- Sempre ligado: o atalho na pasta Inicializar roda `LIGAR NA INICIALIZACAO.vbs` (só liga, sem
  navegador), e o vigia do escritório religa em até 1 min os sistemas de `data/desejados.json`.
- Ligar/desligar sem janela: `LIGAR-DESLIGAR ESCRITORIO.vbs` (atalho
  "Escritório LED SPORTS" na área de trabalho). Desligar por ele também para o vigia.
