'use strict';

const CHAVE = 'planejamento-financeiro-v1';
let estado = { salario: 0, periodos: [] };
let proximoId = 1;
let telaAtual = null;

/* ---------- Funções de apoio ---------- */
const $ = (id) => document.getElementById(id);
const novoId = () => proximoId++;
const arredonda = (v) => Math.round((Number(v) || 0) * 100) / 100;
const dinheiro = (v) => arredonda(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function numero(texto) {
  const n = parseFloat(String(texto).replace(',', '.'));
  return isFinite(n) && n > 0 ? arredonda(n) : 0;
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hoje() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function formataData(iso) {
  if (!iso) return 'sem data';
  const [a, m, d] = iso.split('-');
  return d + '/' + m + '/' + a;
}

/* ---------- Salvar e carregar ---------- */
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* sem problema */ }
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const dados = JSON.parse(bruto);
      if (dados && typeof dados.salario === 'number' && Array.isArray(dados.periodos)) {
        estado = dados;
      }
    }
  } catch (e) { /* começa do zero */ }

  let maior = 0;
  estado.periodos.forEach((p) => {
    if (!Array.isArray(p.itens)) p.itens = [];
    maior = Math.max(maior, p.id || 0);
    p.itens.forEach((i) => { maior = Math.max(maior, i.id || 0); });
  });
  proximoId = maior + 1;
}

/* ---------- Cálculos ---------- */
const totalPeriodo = (p) => arredonda(p.itens.reduce((soma, i) => soma + i.valor, 0));
const totalPlanejado = () => arredonda(estado.periodos.reduce((soma, p) => soma + totalPeriodo(p), 0));

function mensagemSobra(sobra) {
  if (sobra > 0) return ['info', 'Ainda sobram ' + dinheiro(sobra) + ' sem destino. Coloque em algum gasto ou guarde.'];
  if (sobra < 0) return ['erro', 'Cuidado! Você planejou ' + dinheiro(Math.abs(sobra)) + ' a mais do que o seu salário.'];
  return ['ok', 'Perfeito! Todo o seu dinheiro já tem um destino.'];
}

function novoPeriodo() {
  const ultimo = estado.periodos[estado.periodos.length - 1];
  return { id: novoId(), inicio: ultimo && ultimo.fim ? ultimo.fim : hoje(), fim: '', itens: [] };
}

/* ---------- Troca de telas ---------- */
function mostraErroSalario(texto) {
  $('erro-salario').textContent = texto;
  $('erro-salario').hidden = false;
}

function confirmaSalario() {
  const valor = numero($('salario').value);
  if (valor <= 0) {
    mostraErroSalario('Digite um valor maior que zero.');
    return false;
  }
  estado.salario = valor;
  if (estado.periodos.length === 0) estado.periodos.push(novoPeriodo());
  salvar();
  return true;
}

function ir(tela) {
  $('erro-salario').hidden = true;
  if (tela !== 'salario' && estado.salario <= 0) {
    mostraErroSalario('Digite primeiro o valor do seu salário.');
    tela = 'salario';
  }
  if (tela === 'salario' && telaAtual !== 'salario') {
    $('salario').value = estado.salario > 0 ? estado.salario : '';
  }
  telaAtual = tela;

  ['salario', 'planejar', 'resumo'].forEach((t) => { $('tela-' + t).hidden = (t !== tela); });
  document.querySelectorAll('.menu button').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.go === tela);
  });

  if (tela === 'planejar') desenharPeriodos();
  if (tela === 'resumo') desenharResumo();
  window.scrollTo(0, 0);
}

/* ---------- Tela 2: planejar ---------- */
function atualizaNumeros() {
  const planejado = totalPlanejado();
  const sobra = arredonda(estado.salario - planejado);

  $('b-salario').textContent = dinheiro(estado.salario);
  $('b-planejado').textContent = dinheiro(planejado);
  $('b-sobra-rotulo').textContent = sobra < 0 ? 'Passou' : 'Sobra';
  $('b-sobra').textContent = dinheiro(Math.abs(sobra));

  const porcento = estado.salario > 0 ? Math.min(100, (planejado / estado.salario) * 100) : 0;
  $('b-progresso').style.width = porcento + '%';
  $('b-progresso').className = sobra < 0 ? 'estourou' : '';

  const [tipo, texto] = mensagemSobra(sobra);
  $('b-aviso').className = 'aviso ' + tipo;
  $('b-aviso').textContent = texto;

  estado.periodos.forEach((p) => {
    const total = document.querySelector('[data-total-periodo="' + p.id + '"]');
    if (total) total.textContent = dinheiro(totalPeriodo(p));
    const aviso = document.querySelector('[data-aviso-datas="' + p.id + '"]');
    if (aviso) aviso.hidden = !(p.inicio && p.fim && p.fim < p.inicio);
  });
}

function desenharPeriodos() {
  const area = $('periodos');

  if (estado.periodos.length === 0) {
    area.innerHTML = '<p class="vazio">Você ainda não tem nenhum período. Clique em "+ Novo período".</p>';
    atualizaNumeros();
    return;
  }

  area.innerHTML = estado.periodos.map((p, n) => `
    <article class="periodo" data-p="${p.id}">
      <div class="periodo-topo">
        <h3>Período ${n + 1}</h3>
        <button type="button" class="pequeno perigo" data-acao="del-periodo">Remover período</button>
      </div>
      <div class="datas">
        <label>De <input type="date" data-campo="inicio" value="${escapar(p.inicio)}"></label>
        <label>Até <input type="date" data-campo="fim" value="${escapar(p.fim)}"></label>
      </div>
      <p class="aviso erro" data-aviso-datas="${p.id}" hidden>A data final está antes da data inicial.</p>
      <label>Gastos deste período</label>
      ${p.itens.map((i) => `
        <div class="item" data-i="${i.id}">
          <input type="text" list="sugestoes" maxlength="40" data-campo="nome" placeholder="Ex: Alimentação" value="${escapar(i.nome)}" aria-label="Nome do gasto">
          <input type="number" min="0" step="0.01" inputmode="decimal" data-campo="valor" placeholder="R$ 0,00" value="${i.valor || ''}" aria-label="Valor do gasto">
          <button type="button" data-acao="del-item" aria-label="Remover gasto">✕</button>
        </div>`).join('')}
      <button type="button" class="pequeno" data-acao="add-item">+ Adicionar gasto</button>
      <p class="total-periodo">Total deste período: <strong data-total-periodo="${p.id}"></strong></p>
    </article>`).join('');

  atualizaNumeros();
}

$('periodos').addEventListener('click', (e) => {
  const botao = e.target.closest('[data-acao]');
  if (!botao) return;
  const blocoPeriodo = botao.closest('[data-p]');
  const periodo = estado.periodos.find((x) => x.id === Number(blocoPeriodo.dataset.p));
  if (!periodo) return;

  const acao = botao.dataset.acao;
  if (acao === 'add-item') {
    periodo.itens.push({ id: novoId(), nome: '', valor: 0 });
  } else if (acao === 'del-item') {
    const id = Number(botao.closest('[data-i]').dataset.i);
    periodo.itens = periodo.itens.filter((i) => i.id !== id);
  } else if (acao === 'del-periodo') {
    if (!confirm('Remover este período e todos os gastos dele?')) return;
    estado.periodos = estado.periodos.filter((x) => x.id !== periodo.id);
  }

  salvar();
  desenharPeriodos();

  if (acao === 'add-item') {
    const campos = $('periodos').querySelectorAll('[data-p="' + periodo.id + '"] .item [data-campo="nome"]');
    if (campos.length) campos[campos.length - 1].focus();
  }
});

$('periodos').addEventListener('input', (e) => {
  const campo = e.target.dataset.campo;
  if (!campo) return;
  const blocoPeriodo = e.target.closest('[data-p]');
  const periodo = estado.periodos.find((x) => x.id === Number(blocoPeriodo.dataset.p));
  if (!periodo) return;

  if (campo === 'inicio' || campo === 'fim') {
    periodo[campo] = e.target.value;
  } else {
    const blocoItem = e.target.closest('[data-i]');
    const item = periodo.itens.find((x) => x.id === Number(blocoItem.dataset.i));
    if (!item) return;
    if (campo === 'nome') item.nome = e.target.value;
    else item.valor = numero(e.target.value);
  }

  salvar();
  atualizaNumeros();
});

/* ---------- Tela 3: resumo ---------- */
function desenharResumo() {
  const planejado = totalPlanejado();
  const sobra = arredonda(estado.salario - planejado);
  const [tipo, texto] = mensagemSobra(sobra);

  // soma por categoria (Map evita problemas com nomes estranhos)
  const mapa = new Map();
  estado.periodos.forEach((p) => p.itens.forEach((i) => {
    if (i.valor <= 0) return;
    const nome = i.nome.trim() || 'Sem nome';
    const atual = mapa.get(nome.toLowerCase()) || { nome: nome, total: 0 };
    atual.total = arredonda(atual.total + i.valor);
    mapa.set(nome.toLowerCase(), atual);
  }));
  const categorias = Array.from(mapa.values()).sort((a, b) => b.total - a.total);

  const htmlPeriodos = estado.periodos.map((p, n) => {
    const itens = p.itens.filter((i) => i.valor > 0);
    const lista = itens.length
      ? '<ul class="lista">' + itens.map((i) =>
          '<li><span>' + escapar(i.nome.trim() || 'Sem nome') + '</span><span>' + dinheiro(i.valor) + '</span></li>'
        ).join('') + '</ul>'
      : '<p class="vazio">Nenhum gasto neste período.</p>';
    return '<article class="periodo"><h3>Período ' + (n + 1) + '</h3>' +
      '<p class="data-texto">' + formataData(p.inicio) + ' até ' + formataData(p.fim) + '</p>' +
      lista +
      '<p class="total-periodo">Total: <strong>' + dinheiro(totalPeriodo(p)) + '</strong></p></article>';
  }).join('');

  const htmlCategorias = categorias.map((c) => {
    const pct = estado.salario > 0 ? (c.total / estado.salario) * 100 : 0;
    return '<div class="cat"><div class="cat-topo"><span>' + escapar(c.nome) + '</span>' +
      '<span>' + dinheiro(c.total) + ' (' + Math.round(pct) + '%)</span></div>' +
      '<div class="cat-barra"><div style="width:' + Math.min(100, pct) + '%"></div></div></div>';
  }).join('');

  $('resumo').innerHTML =
    '<h2>Resumo do seu plano</h2>' +
    '<div class="barra">' +
      '<div><span>Salário</span><strong>' + dinheiro(estado.salario) + '</strong></div>' +
      '<div><span>Planejado</span><strong>' + dinheiro(planejado) + '</strong></div>' +
      '<div><span>' + (sobra < 0 ? 'Passou' : 'Sobra') + '</span><strong>' + dinheiro(Math.abs(sobra)) + '</strong></div>' +
    '</div>' +
    '<p class="aviso ' + tipo + '">' + texto + '</p>' +
    '<h2>Por período</h2>' + (htmlPeriodos || '<p class="vazio">Nenhum período criado.</p>') +
    '<h2>Para onde vai o dinheiro</h2>' + (htmlCategorias || '<p class="vazio">Nenhum gasto com valor ainda.</p>');
}

/* ---------- Botões ---------- */
document.querySelectorAll('.menu button').forEach((b) => {
  b.addEventListener('click', () => {
    const alvo = b.dataset.go;
    if (telaAtual === 'salario' && alvo !== 'salario' && !confirmaSalario()) return;
    ir(alvo);
  });
});

$('btn-continuar').addEventListener('click', () => {
  if (confirmaSalario()) ir('planejar');
});

$('salario').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('btn-continuar').click();
});

$('btn-add-periodo').addEventListener('click', () => {
  estado.periodos.push(novoPeriodo());
  salvar();
  desenharPeriodos();
});

$('btn-ver-resumo').addEventListener('click', () => ir('resumo'));
$('btn-voltar').addEventListener('click', () => ir('planejar'));

$('btn-apagar').addEventListener('click', () => {
  if (!confirm('Apagar tudo e começar de novo? Isso não pode ser desfeito.')) return;
  estado = { salario: 0, periodos: [] };
  proximoId = 1;
  try { localStorage.removeItem(CHAVE); } catch (e) { /* sem problema */ }
  ir('salario');
});

$('btn-exemplo').addEventListener('click', () => {
  const temDados = estado.periodos.some((p) => p.itens.length > 0);
  if (temDados && !confirm('O exemplo vai substituir o que você já fez. Continuar?')) return;

  const gasto = (nome, valor) => ({ id: novoId(), nome: nome, valor: valor });
  estado = {
    salario: 200,
    periodos: [
      { id: novoId(), inicio: '2026-12-05', fim: '2026-12-15', itens: [
        gasto('Alimentação', 25), gasto('Lazer', 25),
        gasto('Viagem SP 2029', 20), gasto('Emergências e imprevistos', 30)
      ] },
      { id: novoId(), inicio: '2026-12-15', fim: '2027-01-05', itens: [
        gasto('Alimentação', 20), gasto('Lazer', 30),
        gasto('Emergências e imprevistos', 50)
      ] }
    ]
  };
  salvar();
  telaAtual = null;
  ir('planejar');
});

/* ---------- Início ---------- */
carregar();
ir(estado.salario > 0 ? 'planejar' : 'salario');
