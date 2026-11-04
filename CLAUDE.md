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
- Ligar/desligar sem janela: `LIGAR-DESLIGAR ESCRITORIO.vbs` (atalho
  "Escritório LED SPORTS" na área de trabalho).
