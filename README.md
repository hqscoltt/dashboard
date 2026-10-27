# Trycol · Dashboard 3D

Um dashboard que transforma **qualquer conjunto de dados** em um cenário 3D isométrico, no estilo de jogo, com galpões, caminhões e empilhadeiras.
Os mesmos números de um painel comum (vendas, leads, estoque, ordens de serviço…) viram coisas que se movem: cada etapa de um processo é uma seção de galpão, cada registro é um palete na estante, e quando um registro muda de etapa um caminhão leva o palete até a seção seguinte.

Tudo roda no navegador, sem servidor e sem nenhum arquivo 3D externo: os modelos são montados com formas simples (caixas, cilindros) direto no código.

> Todos os dados que vêm no projeto são **fictícios**.

---

## Sumário

1. [O que tem no projeto](#o-que-tem-no-projeto)
2. [Linguagens e tecnologias](#linguagens-e-tecnologias)
3. [Como instalar e rodar](#como-instalar-e-rodar)
4. [Como usar](#como-usar)
5. [Como funciona por dentro](#como-funciona-por-dentro)
6. [Usar com os seus próprios dados](#usar-com-os-seus-próprios-dados)
7. [Estrutura de pastas](#estrutura-de-pastas)
8. [Problemas comuns](#problemas-comuns)

---

## O que tem no projeto

São dois painéis, escolhidos no seletor **Painel** no canto superior esquerdo:

| Painel | O que é |
|---|---|
| **Motor universal** (padrão) | Recebe qualquer dado (exemplos prontos, arquivo JSON/CSV ou uma API) e monta o cenário sozinho. Vem com dois exemplos: **Trycol · Comercial** (vendas, leads e estoque) e **Oficina mecânica** (ordens de serviço e peças). |
| **Logística · Galpão 3D** | Um pátio logístico detalhado e fixo: 3 docas, caminhões que chegam, dão ré e são carregados, empilhadeiras com rota pelos corredores, estoque com 144 posições. É uma simulação própria, feita à mão. |

Recursos principais:

- **Cenário 3D isométrico** com sombras, ciclo dia/noite (no Galpão 3D), cercas, estacionamentos, contêineres e árvores.
- **Câmera:** arrastar com o botão esquerdo move o mapa, **segurar o botão direito e arrastar gira**, a rolagem do mouse dá zoom. Os botões à esquerda aproximam, afastam, giram 90° e voltam para a visão geral.
- **Clique em qualquer coisa** (galpão, palete, caminhão, empilhadeira, doca) para selecionar: aparece uma caixa com cantos destacados, uma etiqueta e o painel de detalhes. Em veículos, aparece também a **rota pontilhada** até o destino.
- **HUD:** busca global, cartões de indicadores (KPIs) com mini-gráfico, funil/etapas, listas por categoria e um registro de eventos.
- **Controles de simulação:** pausar, velocidade 1x/2x/4x, "Simular" (gera movimento de demonstração) e "+ Volume" (adiciona registros).

---

## Linguagens e tecnologias

| Item | Uso |
|---|---|
| **TypeScript** | Linguagem de todo o código (`.ts` e `.tsx`). |
| **React 19** | Interface (HUD) e organização da cena em componentes. |
| **Three.js** | Motor 3D (WebGL) que desenha a cena. |
| **@react-three/fiber** | Ponte entre React e Three.js: a cena 3D é escrita como componentes React. |
| **@react-three/drei** | Utilitários para a cena (câmera ortográfica, controles de câmera, etiquetas HTML). |
| **Zustand** | Estado global (seleção, indicadores, câmera, dados). |
| **Tailwind CSS 4** | Estilo do HUD (painéis translúcidos, botões, listas). |
| **Vite 8** | Servidor de desenvolvimento e build. |

Não há backend: o projeto é só front-end. HTML e CSS existem apenas no mínimo (`index.html` e `src/index.css`).

---

## Como instalar e rodar

### Requisitos

- **Node.js 20.19+ ou 22.12+** (testado com o Node 24). Confira com `node -v`.
- npm (vem junto com o Node).
- Um navegador atual (Chrome, Edge, Firefox). Uma placa de vídeo ajuda bastante, já que a cena é 3D.

### Passo a passo

```bash
git clone https://github.com/hqscoltt/dashboard.git
cd dashboard
npm install
npm run dev
```

Abra **http://localhost:5173** no navegador.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento em `http://localhost:5173`, com recarga automática. |
| `npm run typecheck` | Verifica os tipos do TypeScript, sem gerar arquivos. |
| `npm run build` | Verifica os tipos e gera a versão de produção em `dist/`. |
| `npm run preview` | Serve a versão de produção (`dist/`) para testar localmente. |

A versão de produção (`dist/`) é só um site estático: pode ser publicada em qualquer hospedagem de arquivos (Vercel, Netlify, GitHub Pages, um servidor nginx etc.).

### Usando com o Claude Code

O arquivo [`CLAUDE.md`](CLAUDE.md) traz as instruções para o **Claude Code**: comandos, arquitetura, convenções e armadilhas conhecidas. Basta abrir o Claude Code na pasta do projeto e pedir, por exemplo:

> "Instale as dependências, rode o projeto e me explique como ele funciona."

---

## Como usar

1. Ao abrir, aparece o exemplo **Trycol · Comercial**, com a simulação ligada.
2. Explore o mapa: arraste para mover, segure o botão direito para girar, use a rolagem para o zoom.
3. Clique num galpão para ver quantos registros há naquela etapa; clique num palete para ver o registro; clique num caminhão para ver a rota e o que ele carrega.
4. Use **+ Volume** para adicionar registros e ver as estantes encherem.
5. Em **Painel**, troque para **Oficina mecânica** ou para **Logística · Galpão 3D**.
6. Em **Dados**, carregue os seus próprios dados (veja abaixo).

---

## Como funciona por dentro

### Motor universal (`src/universal/`)

O motor universal entende qualquer dado a partir de um **mapeamento** (um JSON), que descreve três coisas:

| Peça | O que é | No cenário |
|---|---|---|
| **flows** (fluxos) | Listas de registros que passam por etapas (ex.: vendas com `status` = orçamento → confirmada → entregue). | Um **galpão grande por fluxo**, dividido em uma **seção por etapa**, cada uma com a sua doca, estantes e empilhadeiras. Cada registro é um palete. |
| **stocks** (estoques) | Listas com quantidade (ex.: produtos com `saldo`). | Um galpão de estoque, com uma fileira de estantes por categoria. |
| **kpis** | Indicadores calculados com `count`, `sum`, `avg` ou `ratio`, com filtro `where`. | Os cartões no topo e os telões dentro da sede. |

O caminho dos dados é sempre o mesmo:

1. Chega um novo "retrato" dos dados (da simulação, de um arquivo ou da API).
2. `mapping.ts` transforma esse retrato no modelo universal (fluxos, estoques, indicadores).
3. `store.ts` compara com o retrato anterior: os registros que mudaram de etapa entram numa fila de transferência.
4. `fleet.ts` agrupa as transferências em cargas e despacha caminhões. O caminhão dá ré na doca de origem, a empilhadeira traz os paletes da estante até a porta, ele segue pela rua até a doca de destino, descarrega e vai embora.
5. As seções têm **tamanho fixo** (72 posições). Quando passa disso, as estantes ficam cheias e o número real aparece na placa da doca e no painel de detalhes.

Regras de trânsito, para os veículos não se atravessarem:

- **Caminhões:** só são despachados quando as docas de origem e de destino estão livres (ninguém espera doca na rua). Mantêm distância do veículo à frente, e o trecho de rua em frente a uma doca em manobra fica fechado.
- **Empilhadeiras:** circulam em **mão única** dentro de cada seção (faixa da frente → corredor da direita → corredores entre as fileiras → corredor da esquerda). A porta da doca, as vagas e as posições dos paletes são baias: entram de frente e saem de ré. Só uma vai à porta por vez.

### Galpão 3D (`src/scene/` e `src/simulation/`)

Um pátio fixo com uma simulação própria (`simulation/engine.ts`): os caminhões chegam pela estrada, esperam vaga, dão ré na doca e são carregados ou descarregados. As empilhadeiras usam **A\*** (busca de caminho em grade) para andar entre as estantes. Os dados fictícios ficam em `src/data/`, atrás da interface `LogisticsDataSource` (`src/data/dataSource.ts`).

### Desempenho

- Paletes, estantes, árvores e cercas usam **instancing** (milhares de objetos em poucas chamadas de desenho).
- As posições dos veículos ficam fora do React e são lidas a cada quadro (`useFrame`): a simulação não re-renderiza a cena.
- De longe, os paletes viram blocos simples (nível de detalhe), e os paletes das estantes não projetam sombra.

---

## Usar com os seus próprios dados

No botão **Dados** (canto superior direito) há quatro abas:

- **Exemplos:** os painéis prontos.
- **Arquivo:** arraste arquivos **JSON** ou **CSV**. Cada CSV vira uma lista com o nome do arquivo. O mapeamento é gerado automaticamente.
- **API:** informe uma URL que devolva JSON com listas. O painel consulta a cada N segundos e anima só o que mudou. A API precisa permitir CORS para o endereço do painel.
- **Mapeamento:** edite o JSON que diz qual lista é fluxo, qual campo é a etapa, qual é o valor, quais indicadores calcular etc.

Formato de dados esperado (arquivo ou API):

```json
{
  "vendas":   [ { "id": 1, "cliente": "Ana", "status": "aberta", "total": 120.5 } ],
  "produtos": [ { "sku": "A1", "nome": "Café", "categoria": "Bebidas", "saldo": 40 } ]
}
```

Exemplo de mapeamento (veja os completos em `src/universal/presets.ts`):

```json
{
  "name": "Minha empresa",
  "flows": [
    { "id": "vendas", "label": "Vendas", "source": "vendas", "idField": "id", "titleField": "cliente",
      "stageField": "status", "valueField": "total", "valueFormat": "currency", "model": "caixa" }
  ],
  "stocks": [
    { "id": "estoque", "label": "Estoque", "source": "produtos", "idField": "sku", "titleField": "nome",
      "qtyField": "saldo", "groupField": "categoria" }
  ],
  "kpis": [
    { "label": "Faturamento", "source": "vendas", "op": "sum", "field": "total", "where": { "status": "paga" }, "format": "currency" }
  ]
}
```

Para o Galpão 3D, a troca dos dados fictícios por uma API real está descrita em `src/data/apiDataSource.example.ts`.

---

## Estrutura de pastas

```
src/
├── App.tsx                 # escolhe entre o motor universal e o Galpão 3D
├── main.tsx, index.css     # ponto de entrada e estilos globais (Tailwind)
├── store/                  # estado global do Galpão 3D (useSimStore) e do modo atual (useApp)
├── components/             # HUD do Galpão 3D (topo, KPIs, painéis, busca, seletor de painel)
├── scene/                  # cena 3D do Galpão 3D + peças compartilhadas
│   ├── materials.ts        #   geometrias e materiais compartilhados (inclui caixas e paletes detalhados)
│   ├── Decor.tsx           #   cercas, carros, carretas, contêineres, paletes, grama (usado nos dois modos)
│   ├── SelectionBox.tsx    #   caixa de seleção com cantos, etiqueta e rota pontilhada (usado nos dois modos)
│   └── Truck.tsx, Forklift.tsx, Warehouse.tsx, Racks.tsx, Ground.tsx, ...
├── simulation/             # simulação do Galpão 3D (motor, rotas, A*, regras de trânsito)
├── data/                   # tipos, layout do pátio, dados fictícios e a interface de fonte de dados
└── universal/              # motor universal
    ├── types.ts            #   mapeamento e modelo universal
    ├── mapping.ts          #   dados + mapeamento → modelo; geração automática de mapeamento
    ├── presets.ts          #   exemplos prontos (Trycol Comercial, Oficina)
    ├── demoSim.ts          #   movimento de demonstração genérico
    ├── sources.ts          #   leitura de JSON/CSV e consulta periódica à API
    ├── layout.ts           #   posição e tamanho de cada galpão, rua e estante
    ├── store.ts            #   estado, comparação entre retratos e fila de transferências
    ├── fleet.ts            #   caminhões e empilhadeiras (rotas, docas, regras de trânsito)
    ├── hud/                #   painéis do motor universal
    └── scene/              #   cena 3D do motor universal (galpões, caminhões, chão, decoração)
```

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| A página mostra uma versão antiga do código depois de alterações | Pare o `npm run dev` (Ctrl+C) e rode `npm run dev -- --force` (limpa o cache do Vite). |
| Cena lenta | Use um navegador com aceleração por hardware ligada; feche abas pesadas; com muitos dados, a cena já reduz detalhes de longe. |
| "Não consegui ler a API" | A URL precisa devolver JSON e permitir CORS para `http://localhost:5173` (ou o endereço onde o painel estiver publicado). |
| Quero voltar ao estado inicial | Em **Dados → Exemplos**, escolha um exemplo. O painel também guarda o último estado no navegador (localStorage); limpar os dados do site zera tudo. |
