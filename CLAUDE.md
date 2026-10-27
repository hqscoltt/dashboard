# CLAUDE.md — Trycol · Dashboard 3D

Guia para o Claude Code trabalhar neste repositório. O README.md explica o projeto para pessoas; este arquivo é o que o agente precisa saber para instalar, rodar e alterar o código sem quebrar nada.

## Setup e comandos

Requisito: Node.js 20.19+ ou 22.12+ (exigência do Vite 8; testado no 24) e npm.

```bash
npm install          # instala dependências
npm run dev          # http://localhost:5173 (Vite, recarga automática)
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + build de produção em dist/
npm run preview      # serve dist/
```

Não há suíte de testes automatizados. Para validar uma mudança: `npm run typecheck`, `npm run build` e abrir o app no navegador (ou num navegador headless) para conferir visualmente. Se o navegador mostrar código antigo depois de uma edição, reinicie com `npm run dev -- --force`: o cache de transformação do Vite já ficou desatualizado neste projeto.

## Stack

TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`) · React 19 · Three.js via @react-three/fiber 9 + @react-three/drei 10 · Zustand 5 · Tailwind CSS 4 (plugin do Vite) · Vite 8. Só front-end: sem backend, sem arquivos 3D externos (tudo é montado com primitivas).

## Arquitetura

`src/App.tsx` escolhe o modo (persistido em `localStorage` na chave `Trycol:mode`):

1. **Motor universal** — `src/universal/` (padrão). Qualquer dado + um mapeamento JSON viram um site 3D.
   - `types.ts`: `Mapping` (flows, stocks, kpis) e o modelo normalizado (`UModel`).
   - `mapping.ts`: `normalize(mapping, raw)`, cálculo de KPIs, `autoMapping(raw)` (heurísticas para dados desconhecidos).
   - `presets.ts`: exemplos com dados fictícios. `demoSim.ts`: movimento genérico de demonstração.
   - `sources.ts`: leitura de JSON/CSV, consulta periódica à API e o hook `useUniverseDriver`.
   - `layout.ts`: posição/tamanho de galpões, ruas e estantes. **Seções de tamanho fixo** (`SECTION_BAYS` × `SECTION_ROWS` × `LEVELS` = 72 posições); um galpão por fluxo, com seções coladas (`joinL`/`joinR`) e divisórias internas baixas.
   - `store.ts`: estado (Zustand). `applyRaw` compara o retrato novo com o anterior e enfileira transferências; `pickup`/`deliver` atualizam o que está em trânsito.
   - `fleet.ts`: caminhões e empilhadeiras (estado mutável fora do React, avançado por `updateFleet` em `useFrame`).
   - `hud/` e `scene/`: interface e cena 3D do modo universal.
2. **Logística · Galpão 3D** — `src/scene/`, `src/simulation/`, `src/components/`, `src/data/`, `src/store/useSimStore.ts`. Pátio fixo com simulação própria (`simulation/engine.ts`), A* em grade (`pathfinding.ts`) e regras de trânsito (`traffic.ts`). Fonte de dados atrás de `LogisticsDataSource` (`data/dataSource.ts`).

Compartilhado entre os modos: `scene/materials.ts` (geometrias/materiais em cache, inclusive `CARTON_STACK`, `WRAPPED_BLOCK`, `PALLET`), `scene/Decor.tsx` (cerca, carro, carreta, contêiner, paletes, grama), `scene/SelectionBox.tsx` (colchetes de seleção, etiqueta, rota pontilhada), `scene/Truck.tsx` (`TruckModel`), `scene/Forklift.tsx` (`ForkliftModel`), `scene/Lighting.tsx`.

## Regras do código (não quebrar)

- **Posições de veículos ficam fora do React.** Os simuladores mutam objetos simples; os componentes leem em `useFrame` e alteram `ref.current.position` diretamente. Não coloque posições na store do Zustand nem faça `setState` por quadro.
- **Seletores do Zustand que devolvem objeto ou array precisam de `useShallow`**, senão o React entra em loop de renderização.
- **Muitos objetos iguais = `instancedMesh`** (paletes, estantes, árvores, cerca). Geometrias e materiais compartilhados vêm de `materials.ts` (`mat(cor)` faz cache por cor).
- **Nunca deixe duas faces coplanares sobrepostas** (dá "z-fighting": a textura pisca no zoom). Ao encostar ou sobrepor peças, varie o tamanho em alguns centímetros (por exemplo, faixa de 7,46 em baú de 7,5) ou não sobreponha. Seções vizinhas do galpão não duplicam paredes nas emendas.
- **Trânsito:**
  - Caminhões do modo universal só são despachados com as docas de origem **e** destino livres (`fleet.docks`). Ninguém espera doca na rua.
  - O trecho de rua em frente a uma doca em manobra fica fechado (`zoneClosed`).
  - Caminhões encostados acompanham a doca se o layout mudar (`followLayout`).
  - Empilhadeiras do universal andam num **circuito de mão única** por seção (`forkTrip`): faixa da frente → corredor direito → corredores das fileiras → corredor esquerdo. Porta, vagas e posições de palete são baias: entram de frente e saem de ré. A porta tem trava (`fleet.doorLocks`).
  - O caminhão só sai quando a empilhadeira terminou o serviço na porta (`doorPending`).
  - Toda espera tem uma válvula de segurança para a cena nunca congelar.
  - Se mexer nisso, meça colisões e travamentos rodando a simulação a 4x antes de concluir.
- **Desempenho:** paletes das estantes não projetam sombra; de longe usam geometria simples (`LOD_ZOOM` em `universal/scene/Buildings.tsx`). A fila de transferências é limitada (`MAX_QUEUE`, `MAX_WAIT`).
- **Idioma:** textos da interface em português do Brasil; comentários do código em inglês, curtos, explicando o porquê.
- **Dados:** tudo em `presets.ts` e `data/mockData.ts` é fictício. Não coloque dados reais de pessoas no repositório.

## Depuração

Em modo dev, `window.__Trycol` expõe `engine` e `store` (Galpão 3D), `universe` (store universal), `fleet` (caminhões/empilhadeiras) e `focus` (seleciona algo e move a câmera). `window.__scene` é a cena Three.js do Galpão 3D. Úteis para medir a simulação a partir do console ou de um navegador headless.

## Tarefas comuns

- **Novo exemplo de painel:** adicione um `Preset` em `src/universal/presets.ts` (mapeamento + função que gera os dados). Ele aparece no seletor **Painel** e em **Dados → Exemplos**.
- **Conectar uma API real ao universal:** a interface já faz isso (Dados → API). A API deve devolver `{ "lista": [ {...} ] }` e permitir CORS.
- **Conectar uma API real ao Galpão 3D:** implemente `LogisticsDataSource` (veja `src/data/apiDataSource.example.ts`) e troque `source` em `simulation/engine.ts`.
- **Novo objeto de cenário:** monte com primitivas em `scene/Decor.tsx` e reutilize `mat()`/`BOX`; confira se não há faces coplanares.
