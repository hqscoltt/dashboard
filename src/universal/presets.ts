// Example dashboards with fictitious data. Each preset = raw data (as an API would return it)
// + the Mapping that explains it to the engine. Nothing here is special-cased by the engine.
import { createRng } from '../data/mockData'
import type { Mapping, RawData } from './types'

export interface Preset {
  id: string
  label: string
  description: string
  mapping: Mapping
  data: () => RawData
}

const CLIENTES = ['Padaria Pão Dourado', 'Mercado Bom Preço', 'Café Central', 'Doceria Mel', 'Hotel Atlântico', 'Restaurante Sabor & Arte', 'Lanchonete do Zé', 'Empório Serra', 'Pizzaria Forno a Lenha', 'Escola Pequeno Saber', 'Academia Forma Livre', 'Clínica Bem Viver']
const PESSOAS = ['Ana Ribeiro', 'Bruno Lima', 'Carla Souza', 'Diego Martins', 'Elisa Prado', 'Fábio Nunes', 'Gabriela Reis', 'Heitor Campos', 'Isabela Rocha', 'João Pedro Alves', 'Karina Duarte', 'Lucas Ferraz', 'Marina Teles', 'Natália Brito', 'Otávio Mendes', 'Paula Castro']
const VENDEDORES = ['Marina Costa', 'Ricardo Nunes', 'Juliana Alves']
const ORIGENS = ['Site', 'Instagram', 'Indicação', 'Google', 'WhatsApp']
const PRODUTOS: [string, string, string][] = [
  ['Pão francês (kg)', 'Panificação', 'kg'], ['Pão de forma', 'Panificação', 'un'], ['Bolo de cenoura', 'Confeitaria', 'un'],
  ['Croissant', 'Panificação', 'un'], ['Café torrado 500g', 'Mercearia', 'un'], ['Leite integral 1L', 'Laticínios', 'un'],
  ['Queijo minas (kg)', 'Laticínios', 'kg'], ['Iogurte natural', 'Laticínios', 'un'], ['Presunto (kg)', 'Frios', 'kg'],
  ['Mortadela (kg)', 'Frios', 'kg'], ['Farinha de trigo 5kg', 'Insumos', 'un'], ['Açúcar refinado 1kg', 'Insumos', 'un'],
  ['Fermento biológico', 'Insumos', 'un'], ['Manteiga 500g', 'Laticínios', 'un'], ['Torta de limão', 'Confeitaria', 'un'],
  ['Sonho recheado', 'Confeitaria', 'un'], ['Refrigerante 2L', 'Bebidas', 'un'], ['Suco natural 1L', 'Bebidas', 'un'],
  ['Água mineral 500ml', 'Bebidas', 'un'], ['Ovos (dúzia)', 'Insumos', 'un'], ['Chocolate em pó', 'Insumos', 'un'],
  ['Requeijão', 'Laticínios', 'un'], ['Biscoito amanteigado', 'Confeitaria', 'un'], ['Café expresso (dose)', 'Bebidas', 'un'],
]

const isoDay = (daysAgo: number) => new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10)

export const PRESETS: Preset[] = [
  {
    id: 'trycol',
    label: 'Trycol · Comercial',
    description: 'Vendas, leads e estoque com lotes (formato do ERP Trycol)',
    mapping: {
      name: 'Padaria Demo',
      subtitle: 'ERP Trycol · comercial',
      hq: 'Sede · Padaria Demo',
      flows: [
        {
          id: 'vendas', label: 'Vendas', source: 'vendas', idField: 'id', titleField: 'numero', stageField: 'status',
          valueField: 'total', valueFormat: 'currency', model: 'caixa', color: '#2563eb',
          stages: [
            { value: 'orcamento', label: 'Orçamentos' },
            { value: 'confirmada', label: 'Confirmadas' },
            { value: 'separacao', label: 'Em separação' },
            { value: 'entregue', label: 'Entregues' },
            { value: 'cancelada', label: 'Canceladas', terminal: true },
          ],
          details: ['numero', 'cliente', 'total', 'pagamento', 'vendedor', 'data'],
        },
        {
          id: 'leads', label: 'Leads', source: 'leads', idField: 'id', titleField: 'nome', stageField: 'etapa',
          valueField: 'valor_estimado', valueFormat: 'currency', model: 'pessoa', color: '#7c3aed',
          stages: [
            { value: 'novo', label: 'Novos' },
            { value: 'contato', label: 'Em contato' },
            { value: 'proposta', label: 'Proposta' },
            { value: 'ganho', label: 'Ganhos' },
            { value: 'perdido', label: 'Perdidos', terminal: true },
          ],
          details: ['nome', 'empresa', 'origem', 'valor_estimado', 'responsavel', 'criado_em'],
        },
      ],
      stocks: [
        {
          id: 'estoque', label: 'Estoque', source: 'produtos', idField: 'sku', titleField: 'nome', qtyField: 'saldo',
          groupField: 'categoria', unitsPerPallet: 20, lowAt: 15, details: ['sku', 'nome', 'categoria', 'saldo', 'unidade', 'lote', 'validade'],
        },
      ],
      kpis: [
        { label: 'Faturamento', source: 'vendas', op: 'sum', field: 'total', where: { status: ['confirmada', 'separacao', 'entregue'] }, format: 'currency' },
        { label: 'Orçamentos abertos', source: 'vendas', op: 'count', where: { status: 'orcamento' } },
        { label: 'Conversão de leads', source: 'leads', op: 'ratio', where: { etapa: 'ganho' }, of: { etapa: ['ganho', 'perdido'] } },
        { label: 'Unidades em estoque', source: 'produtos', op: 'sum', field: 'saldo' },
      ],
    },
    data: () => {
      const r = createRng(11)
      const vendaStatus = ['orcamento', 'orcamento', 'confirmada', 'confirmada', 'separacao', 'entregue', 'entregue', 'entregue', 'cancelada']
      const vendas = Array.from({ length: 140 }, (_, i) => ({
        id: 1000 + i,
        numero: `V-${1000 + i}`,
        cliente: r.pick(CLIENTES),
        status: r.pick(vendaStatus),
        total: Math.round(r.int(80, 4200) * 100) / 100,
        pagamento: r.pick(['Pix', 'Cartão', 'Boleto', 'Dinheiro']),
        vendedor: r.pick(VENDEDORES),
        data: isoDay(r.int(0, 20)),
      }))
      const leadEtapa = ['novo', 'novo', 'contato', 'contato', 'proposta', 'ganho', 'perdido']
      const leads = Array.from({ length: 90 }, (_, i) => ({
        id: `L${300 + i}`,
        nome: r.pick(PESSOAS),
        empresa: r.pick(CLIENTES),
        etapa: r.pick(leadEtapa),
        origem: r.pick(ORIGENS),
        valor_estimado: r.int(3, 60) * 100,
        responsavel: r.pick(VENDEDORES),
        criado_em: isoDay(r.int(0, 30)),
      }))
      const produtos = PRODUTOS.map(([nome, categoria, unidade], i) => ({
        sku: `P-${String(100 + i)}`,
        nome,
        categoria,
        unidade,
        saldo: r.int(4, 380),
        lote: `L${r.int(2601, 2610)}-${r.int(10, 99)}`,
        validade: isoDay(-r.int(2, 90)),
      }))
      return { vendas, leads, produtos }
    },
  },
  {
    id: 'oficina',
    label: 'Oficina mecânica',
    description: 'Ordens de serviço passando pelas etapas da oficina + estoque de peças',
    mapping: {
      name: 'AutoCenter Serra',
      subtitle: 'Ordens de serviço',
      hq: 'Recepção · AutoCenter',
      flows: [
        {
          id: 'os', label: 'Ordens de serviço', source: 'ordens', idField: 'os', titleField: 'veiculo', stageField: 'situacao',
          valueField: 'valor', valueFormat: 'currency', model: 'veiculo', color: '#0891b2',
          stages: [
            { value: 'recebido', label: 'Recebidos' },
            { value: 'diagnostico', label: 'Diagnóstico' },
            { value: 'aguardando_peca', label: 'Aguardando peça', color: '#f59e0b' },
            { value: 'em_reparo', label: 'Em reparo' },
            { value: 'pronto', label: 'Prontos' },
            { value: 'entregue', label: 'Entregues' },
          ],
          details: ['os', 'veiculo', 'placa', 'cliente', 'servico', 'mecanico', 'valor', 'entrada'],
        },
      ],
      stocks: [
        { id: 'pecas', label: 'Almoxarifado', source: 'pecas', idField: 'codigo', titleField: 'descricao', qtyField: 'quantidade', groupField: 'tipo', unitsPerPallet: 6, lowAt: 4 },
      ],
      kpis: [
        { label: 'OS em andamento', source: 'ordens', op: 'count', where: { situacao: ['recebido', 'diagnostico', 'aguardando_peca', 'em_reparo'] } },
        { label: 'Prontos p/ retirada', source: 'ordens', op: 'count', where: { situacao: 'pronto' } },
        { label: 'Faturado (entregues)', source: 'ordens', op: 'sum', field: 'valor', where: { situacao: 'entregue' }, format: 'currency' },
        { label: 'Ticket médio', source: 'ordens', op: 'avg', field: 'valor', format: 'currency' },
      ],
    },
    data: () => {
      const r = createRng(23)
      const carros = ['Onix', 'HB20', 'Gol', 'Corolla', 'Hilux', 'Strada', 'Compass', 'Civic', 'Kwid', 'T-Cross', 'Renegade', 'S10']
      const servicos = ['Troca de óleo', 'Revisão 40 mil km', 'Freios', 'Suspensão', 'Embreagem', 'Alinhamento', 'Elétrica', 'Ar-condicionado']
      const sit = ['recebido', 'diagnostico', 'diagnostico', 'aguardando_peca', 'em_reparo', 'em_reparo', 'pronto', 'entregue', 'entregue']
      const ordens = Array.from({ length: 46 }, (_, i) => ({
        os: `OS-${2040 + i}`,
        veiculo: r.pick(carros),
        placa: `${'ABCDEFGHJ'[r.int(0, 8)]}${'KLMNPRST'[r.int(0, 7)]}${'UVWXYZ'[r.int(0, 5)]}-${r.int(1, 9)}${'ABCDE'[r.int(0, 4)]}${r.int(10, 99)}`,
        cliente: r.pick(PESSOAS),
        servico: r.pick(servicos),
        mecanico: r.pick(['Seu Jorge', 'Tiago', 'Renan', 'Cláudio']),
        situacao: r.pick(sit),
        valor: r.int(18, 320) * 10,
        entrada: isoDay(r.int(0, 10)),
      }))
      const tipos: [string, string[]][] = [
        ['Filtros', ['Filtro de óleo', 'Filtro de ar', 'Filtro de combustível', 'Filtro de cabine']],
        ['Freios', ['Pastilha dianteira', 'Disco de freio', 'Fluido DOT4']],
        ['Lubrificantes', ['Óleo 5W30 (L)', 'Óleo 10W40 (L)', 'Graxa']],
        ['Suspensão', ['Amortecedor', 'Bieleta', 'Bucha da bandeja']],
        ['Elétrica', ['Bateria 60Ah', 'Lâmpada H4', 'Fusível 10A', 'Vela de ignição']],
      ]
      const pecas = tipos.flatMap(([tipo, nomes]) => nomes.map((descricao) => ({
        codigo: `PC-${r.int(1000, 9999)}`, descricao, tipo, quantidade: r.int(0, 60),
      })))
      return { ordens, pecas }
    },
  },
]
