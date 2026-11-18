// Lista do rancho de outubro de 2026, enviada pelo Jordan a 18 de novembro de 2026.
// Formato de cada produto: [nome, preço, opções]
//   * preço = valor de UMA unidade (quando a lista diz "2x", a quantidade é 2);
//     null = produto da lista sem preço anotado (fica na lista, o preço entra no próximo rancho)
//   * opções: qty (quantidade), unit ('kg' quando o preço é por kg), store (loja diferente
//             da categoria), alt (preço visto noutra loja: só referência, não conta como gasto)
// O rancho é feito entre os dias 20 e 30: os preços ficam com data de 25 out 2026.
// Novembro começa vazio, para uso real.
export const MONTH = '2026-10-01'
export const PURCHASE_DATE = '2026-10-25'

export const STORES = [
  { name: 'Refine Baixa', kind: 'supermercado' },
  { name: 'China Mall', kind: 'supermercado' },
  { name: 'Mercado Fajardo', kind: 'mercado' },
  { name: 'Mercearia Fajardo', kind: 'mercearia' },
  { name: 'Sabores do Mundo', kind: 'mercearia' },
  { name: 'Tia Filista', kind: 'outro' },
]

export const CATEGORIES = [
  {
    name: '🍎 Frutas', store: 'Mercado Fajardo', items: [
      ['Laranja 10kg', 200],
      ['Ananás', 200],
      ['Tangerina', 150],
      ['Maçã', 150],
      ['Banana', 100],
      ['Papaia', 100],
      ['Melancia', 100],
      ['Uvas', null],
      ['Morangos', null],
    ],
  },
  {
    name: '🥬 Verduras e Temperos', store: 'Mercado Fajardo', items: [
      ['Cebola 5kg', 370],
      ['Tomate fresco', 50, { qty: 6, unit: 'kg' }],
      ['Alho 1kg', 200],
      ['Folha de abóbora', 200],
      ['Couve', 100],
      ['Feijão verde', 100],
      ['Folha de feijão nhemba', 50],
      ['Pimenta', 50],
    ],
  },
  {
    name: '🥔 Raízes e Tubérculos', store: 'Mercado Fajardo', items: [
      ['Batata reno 10kg', 400],
      ['Mandioca', 150],
      ['Cenoura', 150],
      ['Batata-doce', 50],
    ],
  },
  {
    name: '🥩 Talho, Peixaria e Charcutaria', store: 'Sabores do Mundo', items: [
      ['Carne', 350, { qty: 3, unit: 'kg' }],
      ['Worse', null, { unit: 'kg' }],
      ['Top Ribs', null, { unit: 'kg' }],
      ['Bife', null, { unit: 'kg' }],
      ['Chuck', null, { unit: 'kg' }],
      ['Carne moída', null, { unit: 'kg' }],
      ['Dobrada', 250],
      ['Mão de vaca', 250],
      ['Carcaça', 200],
      ['Asinha', null, { unit: 'kg' }],
      ['Patinha', null, { unit: 'kg' }],
      ['Peru', null, { unit: 'kg' }],
      ['Fígado de galinha', null],
      ['Moelas', null, { unit: 'kg' }],
      ['Peixe', null, { unit: 'kg' }],
      ['Salsichas', 150, { qty: 2 }],
      ['Palony', 180],
      ['Fiambre', null],
      ['Queijo', null],
      ['Rachel', null],
      ['Frango', 360, { store: 'Tia Filista' }],
    ],
  },
  {
    name: '🌾 Grãos e Secos', store: 'Mercado Fajardo', items: [
      ['Amendoim', 200],
      ['Feijão preto', 150],
      ['Feijão branco', 150],
      ['Coco', 90, { qty: 6 }],
    ],
  },
  {
    name: '🥫 Despensa e Enlatados', store: 'Refine Baixa', items: [
      ['Arroz 10kg', 1850, { alt: ['China Mall', 1850] }],
      ['Óleo 5L', 760, { alt: ['China Mall', 700] }],
      ['Atum', 90, { qty: 4 }],
      ['Ervilhas', 75, { qty: 2, alt: ['China Mall', 75] }],
      ['Boa Mesa', 350],
      ['Farinha de milho', 125, { qty: 2 }],
      ['Açúcar 1kg', 90, { qty: 2 }],
      ['Massa especial', 220],
      ['Massa cotovelo', 46, { qty: 3 }],
      ['Massa esparguete', 35, { qty: 3 }],
      ['Sardinha', 140, { qty: 2 }],
      ['Cogumelos', 100, { qty: 2 }],
      ['Milho doce', 75],
      ['Maionese', 180],
      ['Molho de tomate', 180],
      ['Tomato sauce', 150],
      ['Massa de tomate', 55],
      ['Folha de chá', 140],
      ['Geleia (jam) 480g', 85],
      ['Vinagre', 85],
      ['Cremora', null],
      ['Sal grosso', 40, { store: 'Mercearia Fajardo' }],
    ],
  },
  {
    name: '🥛 Laticínios e Bebidas', store: 'Refine Baixa', items: [
      ['Iogurte 1kg', 250, { qty: 2 }],
      ['Manteiga 500g', 260],
      ['Natas', 200],
      ['Leite fresco', 90, { qty: 4 }],
      ['Iogurtinho 125g', 33, { qty: 6 }],
      ['Suminhos 250ml', 35, { qty: 12 }],
      ['Aqua Plus', 130, { qty: 5 }],
      ['Fusion', 80, { qty: 2 }],
    ],
  },
  {
    name: '🧴 Higiene Pessoal', store: 'Refine Baixa', items: [
      ['Pasta dentífrica Colgate', 300, { qty: 2 }],
      ['Penso higiénico', 300, { qty: 2 }],
      ['Sabonete Securex', 275, { qty: 5 }],
      ['Desodorizante', 250, { qty: 3 }],
      ['Creme Nivea', 250],
      ['Óleo corporal', 250],
      ['Bocejador', 130],
      ['Roll-on', 120, { qty: 2 }],
      ['Sabonete de mão', 110],
      ['Gillette', 100],
      ['Sabonete neutro infantil', 100, { qty: 2 }],
      ['Cotonete', 100],
      ['Colgate infantil', 80],
      ['Escovas de dente (Premier Mica)', null],
    ],
  },
  {
    name: '🧼 Limpeza da Casa', store: 'Refine Baixa', items: [
      ['OMO 2kg', 290],
      ['Recarga da pia', 260],
      ['Harpic verde', 190],
      ['Plástico de lixo', 180],
      ['Amaciador', 170],
      ['Sunlight', 160],
      ['Baygon', 145],
      ['Handy Andy', 140],
      ['Ambientador', 120, { qty: 2 }],
      ['Javel', 100],
      ['Dragão', 65],
      ['Esfregona', 50],
      ['Palha de aço', 35],
    ],
  },
  {
    name: '🧻 Papel e Descartáveis', store: 'Refine Baixa', items: [
      ['Guardanapo Nice', 45, { qty: 3 }],
      ['Papel de alumínio', 90, { store: 'Mercearia Fajardo' }],
      ['Papel aderente', 90, { store: 'Mercearia Fajardo' }],
    ],
  },
]
