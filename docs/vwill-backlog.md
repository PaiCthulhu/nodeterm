# 🍽️ Cardápio da vwill

> **Atualizado em 2026-08-11.** Backlog de features do build pessoal do Will.
> Vive só na `vwill` — nada daqui é oferecido ao upstream sem passar pela regra de corte do
> `CLAUDE.local.md`.

**Cada entrada é uma dor, não uma solução.** O *como resolver* se decide na sessão, junto com o
Will — por isso não há aqui plano, arquivo alvo nem critério de aceite. Se ao alinhar o escopo a
coisa abrir demais, a sessão para e vira spec em `docs/specs/`.

O ritual de uso (apresentar o cardápio, alinhar, implementar, esperar a validação, remover daqui e
commitar) está no `CLAUDE.md`, seção **"Ciclo de uma feature por sessão"**. Item entregue **sai
deste arquivo no mesmo commit da feature** — o histórico do que já foi feito é o `git log`, não uma
lista de "concluídos" apodrecendo aqui embaixo.

---

## 🔴 Resume de sessão nunca usada quebra o nó

**O quê** — abrir um nó de agente claude, **não digitar nada**, deixar o nó morrer (trocar de aba
desmonta) e reabrir devolve `No conversation found with session ID: <uuid>` e um shell pelado, sem
agente. Uma segunda ocorrência, pior, está na busca de transcript: abrir um hit deixa no nó um id
fantasma que pode abandonar uma conversa real que está em disco.

**Por quê** — o id é cunhado pelo nodeterm antes de existir conversa, e nada valida que ele resolve
antes de montar o `--resume`. Perder um nó vazio é chato; perder o ponteiro de uma conversa real é
perda de trabalho. Investigação completa (causa raiz medida, a armadilha dos 18 de 40 nós SSH e as
perguntas em aberto) em [`agent-resume-session-id.md`](agent-resume-session-id.md) — é bug
cross-platform, então fica na `vwill`.

---

## Minimizar no nó de arquivo

**O quê** — o nó de arquivo/editor não tem botão de minimizar; nó de terminal e sticky note têm.

**Por quê** — um arquivo aberto ocupa muito canvas mesmo quando serve só de referência ocasional.
Sem minimizar, a única saída é fechar e reabrir depois, perdendo posição e estado do nó (o modo
preview do `.status-info.md`, por exemplo).

---

## Reset de zoom para 100%

**O quê** — não existe um comando para voltar o canvas ao zoom 1:1.

**Por quê** — depois de dar zoom out para achar um nó do outro lado do projeto, não dá para
recuperar a escala de leitura real: sobra tentativa e erro na roda do mouse até "parecer" 100%.

---

## Open file deveria abrir na pasta do projeto

**O quê** — o botão de abrir arquivo cai num diretório default em vez da raiz do projeto da aba
atual.

**Por quê** — praticamente todo arquivo que se quer abrir no canvas está dentro do projeto. Começar
fora dele obriga a navegar de volta ao mesmo lugar toda vez.

---

## Lock view não segura o canvas do jeito certo

**O quê** — com o lock view ligado, duas coisas ainda saem do lugar:

1. nó novo nasce fora da viewport atual, obrigando a caçar onde ele apareceu;
2. arrastar um nó até a borda não panoramiza (correto), mas em troca o nó **trava na borda** e não
   consegue sair da área visível.

**Por quê** — o lock existe justamente para a câmera ficar parada. Hoje ele erra nas duas pontas:
não garante que o que é criado apareça na tela, e impede de levar um nó para fora dela.
