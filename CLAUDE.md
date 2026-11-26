# Escritório de Agentes — LED SPORTS ATIBAIA

Instalação do [a2labsnutrition/Escritorio-de-agentes](https://github.com/a2labsnutrition/Escritorio-de-agentes)
para a LED SPORTS ATIBAIA. Repositório no GitHub: `escritorio-led-sports` (público), branch `main`.

## Regras de desenho (molde de costura e mockup) — valem sempre, sem o dono repetir

**Antes de qualquer desenho, leia [REGRAS-DE-DESENHO.md](REGRAS-DE-DESENHO.md)**, a lista completa.
Correção do dono que valha para outros pedidos vai para lá. Os funcionários Desenho (4404) e Mockup
(4405) recebem esse arquivo junto com o papel (`agente-fichas/server.js`); mudou o arquivo,
reinicie os dois.

- **Molde de costura é padrão e não muda.** A arte do catálogo (ex.: MOD 46) ou do cliente entra
  por cima do molde base da loja (`DESENHO\MOLDE DE COSTURA\KITS\KIT MADRID.cdr` etc.), em PowerClip
  dentro de cada peça. Trabalhe numa cópia na pasta do cliente. Nunca monte retângulos soltos.
- **Número, escudo e logo da LED têm lugar fixo** (mm, no KIT MADRID; FRENTE L=-204 T=780 621x759,
  COSTAS L=501 T=900 621x878): número das costas centro X=811, topo 632, altura 240; escudo do peito
  topo 645, centro X≈222, altura 85 (ponto verde do molde); LED SPORTS da frente (L=-27 T=612) e das
  costas (L=786 T=870) ficam brancos por cima da arte. Calção normal: escudo centro (332,-662) na
  PERNAD; na PERNAE o logo LED do molde base (pintar de branco) e o número centro X=808, topo -629,
  altura 80. Calção novo: relativo à peça, escudo centro (+540,-473), número centro X +222 e topo
  -438, logo LED acima do número (topo -421). Em dúvida, abra um molde fechado do mesmo modelo
  (Brasinha, Meninos da Tia, Automa FC) e copie. Detalhes na memória `posicoes-padrao-molde-madrid`.
- **Molde primeiro, depois mockup:** qualquer ajuste de arte entra no molde de costura e o mockup
  é montado ou atualizado a partir dele, sem o dono precisar pedir.
- **Nunca mexer nos quadros do mockup** (LOGO, DETALHE GOLA, M. DIREITA, M. ESQUERDA): são padrão
  e mostram ao cliente o que vai na manga e na gola. Não esconder camadas nem colar recortes. Eles se
  atualizam sozinhos; o PNG que substitui GOLA DE DENTRO e MANGA precisa ter o mesmo tamanho em
  pixels e 300 dpi do original, senão o quadro sai ampliado.
- **Modelos novos (Madrid, Apollo Nova = Red Bull, Isin, Liverpool): sempre as duas versões de
  calção** (novo e normal). Molde do calção novo: `DESENHO\MOLDE DE COSTURA\CAMISAS\CALÇÃO NOVO.cdr`.
- **Tudo desmembrado:** cada elemento da arte solto (fundo, escritas, retrato, mascote), nunca
  agrupado nem achatado.
- **Fonte de número/nome sem escolha do cliente:** Liverpool, Flamengo ou alguma da Adidas
  (Liverpool primeiro); avisar o dono qual usou. Nome e número só entram se a arte do cliente ou a
  ficha trouxer; no calção o dono quer o número (e o logo da LED) mesmo assim.
- O círculo "LED" dos modelos do catálogo é reserva do escudo do cliente: troque pelo escudo.
- Nada vai ao cliente sem o dono mandar.
- **Economia de tokens:** uma conversa por cliente/tarefa. Ao começar um cliente, leia o
  `PEDIDO*.txt` e o `STATUS.md` da pasta dele (`ARTES\CLIENTES\<CLIENTE>\`) antes de mexer. Ao
  terminar uma rodada ou quando o dono pedir para fechar, atualize o `STATUS.md` (pronto / em
  andamento / falta / regras desse cliente) e avise que dá para abrir conversa nova. O `STATUS.md`
  fica no Drive, nunca no git. Poucas prévias, em tamanho menor, e não reabra imagens já vistas.
  O dono usa o celular e não consegue abrir conversa nova: **abra você a sessão do cliente**
  (`start_session` com brief apontando para a pasta, o PEDIDO e o STATUS.md) quando ele passar a
  falar de outro cliente, e avise em uma linha qual abriu.

## Regra: toda atualização vai para o GitHub

Depois de qualquer mudança nos arquivos deste projeto: `git add -A`, commit com
mensagem em português dizendo o que mudou, e `git push`. Não deixe mudança só local.

- `data/*.json` (exceto os `*.exemplo.json`) fica fora do git de propósito: tem
  configuração, equipe e a chave do CallMeBot. O repositório é público — nunca
  versionar segredos.
- `agente-desenho/`: formulário do funcionário Desenho (porta 4402), com novo desenho e alteração de
  arte pronta. Pede o pedido completo (camisa, calção, referência, cores da paleta, gola, fonte,
  número, nome, escudo, patrocínios). Grava em `ARTES\CLIENTES\<CLIENTE>` na raiz do Drive (nunca em
  `DESENHO\ARTES`), com os anexos em `REFERENCIA`, e entrega à conversa do cliente. O Desenho (4404)
  roda no Sonnet com esforço médio, segue a memória `receita-arte-led` do projeto SAFUL e nunca
  acessa o Nextcloud. Tem o Chrome do dono (`--chrome`: Firefly, Aimari) e WebSearch/WebFetch, como
  as conversas por cliente do SAFUL, com regras de economia no `PAPEL_DESENHO`. Dados de cliente
  nunca entram no git.
- O atendente (`C:\LED-atendente`, sem git) já manda sozinho o card que chega em "Aguardando
  desenho" para o 4402 (`src/desenho.js`) e devolve a arte ao dono para `aprovar N`. Se o cliente
  muda modelo, cores, número etc. depois do envio, `mudancaDoCliente` manda a diferença ao Desenho.
  Mensagem que a Meta entrega como `unsupported` (áudio de visualização única etc.): `avisarIlegivel`
  avisa o dono e SEMPRE pede ao cliente para mandar de novo. Cliente nunca fica sem resposta.
  Conversa pausada (dono atendendo pelo celular): a IA não responde, mas `guardarSemResponder` guarda
  no histórico tudo o que o cliente mandou. Assessoria só com o necessário: imagem com `_` no nome é
  trabalho do Desenho e não vai ao dono; pedido de desenho e mudança do cliente só avisam se falhar. Antes de mexer
  lá, LEIA o arquivo: em 09/11 um `desenho.js` foi sobrescrito sem ler e teve de ser refeito pelo
  histórico.
- Pedido fechado pelo cliente (etapa "fechado" no atendente) vira ficha de pedido em Excel + PDF pelo
  montador de fichas do Juninho (`src/pedido-fechado.js` + `emitirPedido` no `servidor.js`). A ficha
  vai PRIMEIRO ao dono na assessoria; o cliente só recebe depois do ok dele ("manda o pedido pro
  FULANO"). Nunca mandar ficha direto ao cliente. No Kanban, o botão 📋 Emitir pedido refaz.
- Mudou layout/script das fichas em `C:\LED-atendente\app`? Reinicie o `programa-fichas` (3210) pelo
  escritório; o atendente (3300) precisa de restart se mudou `atendente\src`. Para reenviar ao dono uma
  ficha refeita (aprovar arte e mandar pedido pela assessoria só valem com o nome do cliente na
  mensagem, `citaCliente` em `conversa-dono.js`; "pode mandar" solto vira pergunta): `POST 3300/painel/api/pdf-dono {arquivos:[PDFs da pasta FICHAS], texto}` (só vai ao dono).
  Ficha conferida indo ao cliente (SÓ depois do ok do dono): `POST 3300/painel/api/pdf-cliente {id, arquivos, texto}`.
  Mensagem manual a cliente/dono: sempre por `fetch` em node (UTF-8), nunca curl com texto acentuado.
  `POST 3300/painel/api/enviar {para, texto, combinado?}` entra no histórico (e `combinado` na observação
  da ficha); catálogo/tabela a um cliente: `POST 3300/painel/api/documento {id, chave:'modelos:FUTEBOL', texto}`.
  Tirar um card do Kanban: `POST 3300/painel/api/excluir {id}` (a conversa fica em `dados\excluidas.json`).
- Mandar arte ao cliente (uma ou várias imagens, ex.: mockup calção novo e normal), SEMPRE pedindo o
  ok do dono: `POST 3300/painel/api/arte-para-aprovar {id, arquivos:[JPGs de ARTES\CLIENTES], texto}`
  (via `fetch` em node). O robô manda as imagens ao dono e pergunta "Posso mandar?"; só vai ao cliente
  depois de "aprovado <time>" ou "aprovar N". Se o dono estiver há +24h sem escrever na assessoria, as
  imagens vão quando ele mandar qualquer mensagem; ao cliente também só vai dentro de 24h da última
  mensagem dele. Backup antes dessa função: `servidor.bak-20261125-arte-varias.js`.
- Cliente que o dono diz que já está resolvido: `POST 3300/painel/api/resolvido {id, dias_sem_ia?}`.
  Sai da lista de quem espera resposta (só volta se o cliente escrever de novo); com `dias_sem_ia`
  a IA também fica fora (e sem lembretes) por esse tempo, mesmo que o dono responda pelo celular.
  Backup antes dessa função: `servidor.bak-20261125-resolvido.js`.
  Parceiro da loja (ex.: Camila, como o Dema), que a IA nunca deve responder: mesma rota com
  `{nao_atender:true}` (entra na lista de não atender e sai dos relatórios).
  Cliente que o dono deixa pendente e não quer arte sem pagamento: mesma rota com
  `{manter_pendente:true, dias_sem_ia:3, sem_arte:true, observacao}`. Nunca travar por mais tempo sem
  ele pedir: o padrão é a trava normal de 3 dias, e se o cliente escrever depois, a loja atende.
- Dono mandou na conversa "manda essas artes pro cliente": `POST 3300/painel/api/arte-cliente
  {id, arquivos:[JPGs de ARTES\CLIENTES], texto}` vai direto ao cliente (SÓ com essa ordem dele; sem
  ordem, usar `arte-para-aprovar`). Backup antes: `servidor.bak-20261125-arte-cliente.js`.
- Tecidos (regra do dono, 25/11): camisa e CALÇÃO são dry fit; TACTEL é só bermuda. Nunca dizer a
  cliente que calção é tactel (`dados\catalogo.json` e `src\regras.js` do atendente já corrigidos).
- O atendente usa `MODELO_IA=claude-sonnet-5-5`, que NÃO aceita `tool_choice` forçado (erro 400):
  em `conversa-dono.js` é `auto` desde 25/11 (backup `conversa-dono.bak-20261125-tool-choice.js`).
  Ao trocar o modelo do atendente, testar a IA do dono antes.
- `agente-fichas/`: conversa por cliente, com anexos, dos funcionários Fichas (porta 4403) e Desenho
  (`AGENTE=desenho`, porta 4404). O cadastro deles está em `data/sistemas.json`. Pelo WhatsApp só o
  Fichas recebe pedido ("Ficha TIME"); desenho é feito direto no Claude.
- Mockup (porta 4405, `AGENTE=mockup` no mesmo `agente-fichas`): pega o molde aprovado e monta o
  mockup numa cópia da base `DESENHO\BASE MOCKUPS\2027` na pasta do cliente; regras no `PAPEL_MOCKUP`.
  Não mexe no atendente nem nos agentes do Fábio e do Juninho.
- Acompanhamento (`agente-acompanhamento/`, porta 4406, sem IA): a cada 10 min lê o quadro do atendente
  e `dados\conversas.json` (só leitura) e avisa o dono pela assessoria quando um cliente com a IA ligada
  fica +30 min sem resposta. DESLIGADO desde 12/11: o dono só quer o resumo das 8h e o relatório das
  19h30 do atendente (mais os avisos de problema). Não religar sem ele pedir. Chaves vêm do `.env` do
  atendente via o `config.js` dele; estado em `agente-acompanhamento/dados` (fora do git).
- Painel VENDAS do mês (parede norte da Sala de Serviço, `js/vendas.js` + `/api/vendas`): só lê
  `config.vendas.arquivo` (neste PC, `C:\LED-atendente\app\vendas.json`, que o programa de fichas
  e o atendente do WhatsApp gravam) e soma o mês por vendedor (FÁBIO, JUNINHO). Dia 1º, a partir das
  9h, o atendente manda sozinho ao dono, pela assessoria, as vendas do mês que fechou
  (`vendasDoMesQueFechou`, marca em `dados\vendas-mensal.json`); "vendas" / "vendas mes passado" pedem na hora.
- Quadro branco da Diretoria: ideias à esquerda (`/api/quadro`, `data/quadro.json`, editadas no
  botão 📌 Quadro) e o esquema FUNIL DO MÊS à direita (`/api/funil`, que lê `config.funil.url` =
  `http://localhost:3300/painel/api/mes` do Kanban do atendente, com cache de 1 min).
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
- Login dos funcionários Claude (Fichas 4403, Desenho 4404, Mockup 4405): usam a chave de 1 ano de
  `claude setup-token` guardada em `data/claude-token.json` (fora do git; `envClaude()` em
  `claude-bin.js`). Vence em 13/11/2027: refazer com `claude setup-token` e reiniciar os três.
  Sem aviso no WhatsApp se cair (o dono não quer mais mensagens): conferir em `/api/login` de cada um.
- Avisos do atendente ao dono (13/11): no WhatsApp só vão arte para aprovar, ficha para conferir,
  respostas aos comandos dele e o resumo das 8h e o relatório das 19h30, os dois com as vendas do mês
  e os clientes esperando resposta, com o tempo de espera (`textoVendasEEspera` em `servidor.js`).
  Pedido de ajuda da IA, dúvida do Desenho, "fechou o pedido", mensagem ilegível, fora do ar e crédito
  baixo vão só para o log (`soNoLog`). Só o aviso "créditos ACABARAM" continua indo ao dono.
  Backup antes da mudança: `servidor.bak-20261113-so-relatorio.js`.
