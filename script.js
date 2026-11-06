'use strict';

/*
 * AUGUSTO | FINANÇAS
 * Mantém a chave antiga do localStorage para preservar os planejamentos existentes.
 */
const CHAVE = 'planejamento-financeiro-v1';
const CATEGORIAS = [
  'Alimentação', 'Moradia', 'Contas', 'Transporte', 'Saúde', 'Educação',
  'Lazer', 'Compras', 'Viagem', 'Assinaturas', 'Guardar dinheiro',
  'Emergências', 'Outros'
];
const STATUS = { pago: 'Pago', pendente: 'Pendente' };

let estado = { salario: 0, periodos: [] };
let proximoId = 1;
let telaAtual = null;
let storageDisponivel = true;

const $ = (id) => document.getElementById(id);
const novoId = () => proximoId++;
const arredonda = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
const dinheiro = (valor) => arredonda(valor).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL'
});
const dataValida = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);

// Aceita valores no padrão brasileiro (3.500,00) e decimal simples (3500.00).
function numero(texto) {
  let valor = String(texto == null ? '' : texto).trim();
  if (!valor) return 0;
  valor = valor.replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (valor.includes(',')) {
    valor = valor.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(valor)) {
    valor = valor.replace(/\./g, '');
  }
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido > 0 ? arredonda(convertido) : 0;
}

function formatarCampoDinheiro(valor) {
  return Number(valor) > 0
    ? Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
}

function escapar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hoje() {
  const data = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function formataData(iso) {
  if (!dataValida(iso)) return 'Não definida';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function atualizarStatusSalvamento(sucesso, mensagem) {
  const status = $('save-status');
  const texto = $('save-status-text');
  if (!status || !texto) return;
  status.classList.toggle('erro', !sucesso);
  texto.textContent = mensagem || (sucesso ? 'Salvo neste dispositivo' : 'Salvamento indisponível');
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    storageDisponivel = true;
    atualizarStatusSalvamento(true);
    return true;
  } catch (erro) {
    storageDisponivel = false;
    atualizarStatusSalvamento(false, 'Não foi possível salvar neste navegador');
    return false;
  }
}

function normalizarEstado(dados) {
  if (!dados || typeof dados !== 'object' || !Array.isArray(dados.periodos)) return null;
  const salario = Number(dados.salario);
  if (!Number.isFinite(salario) || salario < 0) return null;

  let maiorId = 0;
  dados.periodos.forEach((periodo) => {
    maiorId = Math.max(maiorId, Number(periodo && periodo.id) || 0);
    if (periodo && Array.isArray(periodo.itens)) {
      periodo.itens.forEach((item) => { maiorId = Math.max(maiorId, Number(item && item.id) || 0); });
    }
  });
  proximoId = Math.max(1, Math.floor(maiorId) + 1);
  const idsUsados = new Set();
  const reivindicarId = (original) => {
    const id = Number(original);
    if (Number.isSafeInteger(id) && id > 0 && !idsUsados.has(id)) {
      idsUsados.add(id);
      return id;
    }
    let novo = novoId();
    while (idsUsados.has(novo)) novo = novoId();
    idsUsados.add(novo);
    return novo;
  };

  const periodos = dados.periodos.map((periodo) => {
    const origem = periodo && typeof periodo === 'object' ? periodo : {};
    const itensOriginais = Array.isArray(origem.itens) ? origem.itens : [];
    const itens = itensOriginais.map((item) => {
      const gasto = item && typeof item === 'object' ? item : {};
      const nome = String(gasto.nome == null ? '' : gasto.nome).slice(0, 80);
      const categoriaAntiga = CATEGORIAS.find((categoria) => categoria.toLowerCase() === nome.trim().toLowerCase());
      const categoriaInformada = CATEGORIAS.find((categoria) => categoria === gasto.categoria);
      const valor = Number(gasto.valor);
      return {
        id: reivindicarId(gasto.id),
        nome,
        categoria: categoriaInformada || categoriaAntiga || 'Outros',
        valor: Number.isFinite(valor) && valor > 0 ? arredonda(valor) : 0,
        status: gasto.status === 'pago' ? 'pago' : 'pendente'
      };
    });
    return {
      id: reivindicarId(origem.id),
      inicio: dataValida(origem.inicio) ? origem.inicio : '',
      fim: dataValida(origem.fim) ? origem.fim : '',
      itens
    };
  });

  return { salario: arredonda(salario), periodos };
}

function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return;
    const dados = normalizarEstado(JSON.parse(bruto));
    if (dados) {
      estado = dados;
      // Grava o formato atualizado sem descartar os dados antigos.
      salvar();
    } else {
      atualizarStatusSalvamento(false, 'Dados antigos precisam ser conferidos');
    }
  } catch (erro) {
    atualizarStatusSalvamento(false, 'Não foi possível ler os dados salvos');
  }
}

/* Cálculos */
const totalPeriodo = (periodo) => arredonda(periodo.itens.reduce((soma, item) => soma + item.valor, 0));
const totalPlanejado = () => arredonda(estado.periodos.reduce((soma, periodo) => soma + totalPeriodo(periodo), 0));
const totalPorStatus = (status) => arredonda(estado.periodos.reduce((soma, periodo) => {
  return soma + periodo.itens.reduce((parcial, item) => parcial + (item.status === status ? item.valor : 0), 0);
}, 0));
const totalPago = () => totalPorStatus('pago');
const totalPendente = () => totalPorStatus('pendente');

function mensagemSaldo(saldo) {
  if (saldo < 0) {
    return ['error', `Seu planejamento ultrapassou a renda em ${dinheiro(Math.abs(saldo))}. Revise os valores antes de continuar.`];
  }
  if (saldo === 0) return ['ok', 'Todo o valor disponível já tem um destino.'];
  return ['info', `Você ainda tem ${dinheiro(saldo)} disponíveis para planejar ou guardar.`];
}

function novoPeriodo() {
  const ultimo = estado.periodos[estado.periodos.length - 1];
  return {
    id: novoId(),
    inicio: ultimo && ultimo.fim ? ultimo.fim : hoje(),
    fim: '',
    itens: []
  };
}

function mostraErroSalario(texto) {
  $('erro-salario').textContent = texto;
  $('erro-salario').hidden = false;
}

function confirmaSalario() {
  const valor = numero($('salario').value);
  if (valor <= 0) {
    mostraErroSalario('Digite um valor maior que zero para continuar.');
    $('salario').focus();
    return false;
  }
  estado.salario = valor;
  if (estado.periodos.length === 0) estado.periodos.push(novoPeriodo());
  salvar();
  return true;
}

function ir(tela) {
  if (!['salario', 'planejar', 'resumo'].includes(tela)) return;
  $('erro-salario').hidden = true;
  if (tela !== 'salario' && estado.salario <= 0) {
    mostraErroSalario('Informe sua renda antes de abrir o planejamento.');
    tela = 'salario';
  }
  if (tela === 'salario') $('salario').value = formatarCampoDinheiro(estado.salario);

  telaAtual = tela;
  ['salario', 'planejar', 'resumo'].forEach((nome) => {
    $('tela-' + nome).hidden = nome !== tela;
  });
  document.querySelectorAll('.menu button').forEach((botao) => {
    const ativo = botao.dataset.go === tela;
    botao.classList.toggle('ativo', ativo);
    botao.setAttribute('aria-current', ativo ? 'step' : 'false');
  });

  if (tela === 'planejar') desenharPeriodos();
  if (tela === 'resumo') desenharResumo();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Tela de planejamento */
function atualizaNumeros() {
  const planejado = totalPlanejado();
  const pago = totalPago();
  const saldo = arredonda(estado.salario - planejado);
  const percentualReal = estado.salario > 0 ? (planejado / estado.salario) * 100 : 0;
  const percentualBarra = Math.max(0, Math.min(100, percentualReal));

  $('b-salario').textContent = dinheiro(estado.salario);
  $('b-planejado').textContent = dinheiro(planejado);
  $('b-pago').textContent = dinheiro(pago);
  $('b-sobra-rotulo').childNodes[0].textContent = saldo < 0 ? 'Valor excedido ' : 'Saldo disponível ';
  $('b-sobra').textContent = dinheiro(Math.abs(saldo));
  $('b-percentual').textContent = `${Math.round(Math.max(0, percentualReal))}%`;
  $('b-progresso').style.width = percentualBarra + '%';
  $('b-progresso').classList.toggle('estourou', saldo < 0);
  $('b-progresso-track').setAttribute('aria-valuenow', String(Math.round(percentualBarra)));

  const [tipo, texto] = mensagemSaldo(saldo);
  $('b-aviso').className = 'notice ' + tipo;
  $('b-aviso').textContent = texto;

  estado.periodos.forEach((periodo) => {
    const total = document.querySelector(`[data-total-periodo="${periodo.id}"]`);
    const pagoPeriodo = document.querySelector(`[data-pago-periodo="${periodo.id}"]`);
    const pendentePeriodo = document.querySelector(`[data-pendente-periodo="${periodo.id}"]`);
    const aviso = document.querySelector(`[data-aviso-datas="${periodo.id}"]`);
    if (total) total.textContent = dinheiro(totalPeriodo(periodo));
    if (pagoPeriodo) pagoPeriodo.textContent = dinheiro(periodo.itens.reduce((soma, item) => soma + (item.status === 'pago' ? item.valor : 0), 0));
    if (pendentePeriodo) pendentePeriodo.textContent = dinheiro(periodo.itens.reduce((soma, item) => soma + (item.status === 'pendente' ? item.valor : 0), 0));
    if (aviso) aviso.hidden = !(periodo.inicio && periodo.fim && periodo.fim < periodo.inicio);
  });
}

function opcoesCategoria(selecionada) {
  return CATEGORIAS.map((categoria) => `<option value="${escapar(categoria)}" ${categoria === selecionada ? 'selected' : ''}>${escapar(categoria)}</option>`).join('');
}

function desenharPeriodos() {
  const area = $('periodos');
  if (estado.periodos.length === 0) {
    area.innerHTML = '<div class="empty-state">Nenhum período criado. Use “Novo período” para começar a organizar suas despesas.</div>';
    atualizaNumeros();
    return;
  }

  area.innerHTML = estado.periodos.map((periodo, indice) => `
    <article class="period-card" data-p="${periodo.id}">
      <div class="period-header">
        <div class="period-title"><span class="period-index">${String(indice + 1).padStart(2, '0')}</span><h4>Período ${indice + 1}</h4></div>
        <div class="period-total">Total planejado<strong data-total-periodo="${periodo.id}">${dinheiro(totalPeriodo(periodo))}</strong></div>
      </div>
      <div class="period-dates">
        <div class="field"><label for="inicio-${periodo.id}">Data inicial</label><input id="inicio-${periodo.id}" type="date" data-campo="inicio" value="${escapar(periodo.inicio)}"></div>
        <div class="field"><label for="fim-${periodo.id}">Data final</label><input id="fim-${periodo.id}" type="date" data-campo="fim" value="${escapar(periodo.fim)}"></div>
      </div>
      <p class="period-error" data-aviso-datas="${periodo.id}" hidden>A data final não pode ser anterior à data inicial.</p>
      <div class="expense-heading" aria-hidden="true"><span>Descrição</span><span>Categoria</span><span>Valor (R$)</span><span>Situação</span><span></span></div>
      <div class="expense-list">
        ${periodo.itens.map((item) => `
          <div class="expense-row" data-i="${item.id}">
            <div class="field field-name"><label class="mobile-field-label">Descrição</label><input type="text" maxlength="80" data-campo="nome" value="${escapar(item.nome)}" placeholder="Ex.: Conta de internet" aria-label="Descrição da despesa"></div>
            <div class="field field-category"><label class="mobile-field-label">Categoria</label><select data-campo="categoria" aria-label="Categoria da despesa">${opcoesCategoria(item.categoria)}</select></div>
            <div class="field field-value"><label class="mobile-field-label">Valor (R$)</label><input type="text" inputmode="decimal" maxlength="16" data-campo="valor" value="${item.valor > 0 ? escapar(formatarCampoDinheiro(item.valor)) : ''}" placeholder="0,00" aria-label="Valor em reais"></div>
            <div class="field field-status"><label class="mobile-field-label">Situação</label><select data-campo="status" aria-label="Situação do pagamento"><option value="pendente" ${item.status === 'pendente' ? 'selected' : ''}>Pendente</option><option value="pago" ${item.status === 'pago' ? 'selected' : ''}>Pago</option></select></div>
            <button type="button" class="remove-expense" data-acao="del-item" aria-label="Remover despesa" title="Remover esta despesa">×</button>
          </div>`).join('')}
      </div>
      <div class="period-footer">
        <button type="button" class="button secondary small" data-acao="add-item">+ Adicionar despesa</button>
        <div class="period-breakdown"><span>Pago: <strong data-pago-periodo="${periodo.id}">${dinheiro(periodo.itens.reduce((s, item) => s + (item.status === 'pago' ? item.valor : 0), 0))}</strong></span><span>Pendente: <strong data-pendente-periodo="${periodo.id}">${dinheiro(periodo.itens.reduce((s, item) => s + (item.status === 'pendente' ? item.valor : 0), 0))}</strong></span></div>
      </div>
      <div class="period-remove-row"><button type="button" class="button small danger" data-acao="del-periodo">Remover período</button></div>
    </article>`).join('');

  atualizaNumeros();
}

$('periodos').addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-acao]');
  if (!botao) return;
  const blocoPeriodo = botao.closest('[data-p]');
  if (!blocoPeriodo) return;
  const periodo = estado.periodos.find((item) => item.id === Number(blocoPeriodo.dataset.p));
  if (!periodo) return;

  const acao = botao.dataset.acao;
  if (acao === 'add-item') {
    const novoItem = { id: novoId(), nome: '', categoria: 'Outros', valor: 0, status: 'pendente' };
    periodo.itens.push(novoItem);
    salvar();
    desenharPeriodos();
    const campo = document.querySelector(`[data-p="${periodo.id}"] [data-i="${novoItem.id}"] [data-campo="nome"]`);
    if (campo) campo.focus();
    return;
  }
  if (acao === 'del-item') {
    const blocoItem = botao.closest('[data-i]');
    if (!blocoItem) return;
    const id = Number(blocoItem.dataset.i);
    periodo.itens = periodo.itens.filter((item) => item.id !== id);
  } else if (acao === 'del-periodo') {
    if (!window.confirm('Remover este período e todas as despesas dele?')) return;
    estado.periodos = estado.periodos.filter((item) => item.id !== periodo.id);
  }

  salvar();
  desenharPeriodos();
});

function atualizarCampoPeriodo(evento) {
  const campo = evento.target.dataset.campo;
  if (!campo) return;
  const blocoPeriodo = evento.target.closest('[data-p]');
  if (!blocoPeriodo) return;
  const periodo = estado.periodos.find((item) => item.id === Number(blocoPeriodo.dataset.p));
  if (!periodo) return;

  if (campo === 'inicio' || campo === 'fim') {
    periodo[campo] = evento.target.value;
  } else {
    const blocoItem = evento.target.closest('[data-i]');
    if (!blocoItem) return;
    const item = periodo.itens.find((registro) => registro.id === Number(blocoItem.dataset.i));
    if (!item) return;
    if (campo === 'nome') item.nome = evento.target.value.slice(0, 80);
    if (campo === 'categoria' && CATEGORIAS.includes(evento.target.value)) item.categoria = evento.target.value;
    if (campo === 'valor') item.valor = numero(evento.target.value);
    if (campo === 'status' && Object.hasOwn(STATUS, evento.target.value)) item.status = evento.target.value;
  }
  salvar();
  atualizaNumeros();
}

$('periodos').addEventListener('input', atualizarCampoPeriodo);
$('periodos').addEventListener('change', atualizarCampoPeriodo);

/* Visão geral */
function gerarTotaisCategoria() {
  const mapa = new Map();
  estado.periodos.forEach((periodo) => periodo.itens.forEach((item) => {
    if (item.valor <= 0) return;
    const atual = mapa.get(item.categoria) || { nome: item.categoria, total: 0, pago: 0, pendente: 0 };
    atual.total = arredonda(atual.total + item.valor);
    atual[item.status] = arredonda(atual[item.status] + item.valor);
    mapa.set(item.categoria, atual);
  }));
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

function desenharResumo() {
  const planejado = totalPlanejado();
  const pago = totalPago();
  const pendente = totalPendente();
  const saldo = arredonda(estado.salario - planejado);
  const [tipo, texto] = mensagemSaldo(saldo);
  const categorias = gerarTotaisCategoria();
  const percentual = estado.salario > 0 ? Math.max(0, Math.min(100, (planejado / estado.salario) * 100)) : 0;

  const htmlCategorias = categorias.length ? categorias.map((categoria) => {
    const pct = planejado > 0 ? (categoria.total / planejado) * 100 : 0;
    return `<div class="category-row"><div class="category-top"><span>${escapar(categoria.nome)}</span><span>${dinheiro(categoria.total)} · ${Math.round(pct)}%</span></div><div class="category-track"><span style="width:${Math.min(100, pct)}%"></span></div><small class="category-status">Pago: ${dinheiro(categoria.pago)} · Pendente: ${dinheiro(categoria.pendente)}</small></div>`;
  }).join('') : '<div class="empty-state">Adicione despesas para visualizar a divisão do seu orçamento por categoria.</div>';

  const htmlPeriodos = estado.periodos.length ? estado.periodos.map((periodo, indice) => {
    const itens = periodo.itens.filter((item) => item.valor > 0 || item.nome.trim());
    const lista = itens.length ? `<ul class="summary-expenses">${itens.map((item) => `
      <li><div class="expense-name"><strong>${escapar(item.nome.trim() || 'Despesa sem descrição')}</strong><small>${escapar(item.categoria)}</small></div><div class="expense-value"><strong>${dinheiro(item.valor)}</strong><span class="status-label">${STATUS[item.status]}</span></div></li>`).join('')}</ul>` : '<p class="empty-state">Nenhuma despesa cadastrada neste período.</p>';
    const pagoPeriodo = periodo.itens.reduce((soma, item) => soma + (item.status === 'pago' ? item.valor : 0), 0);
    const pendentePeriodo = periodo.itens.reduce((soma, item) => soma + (item.status === 'pendente' ? item.valor : 0), 0);
    return `<article class="summary-period"><div class="summary-period-head"><div><h4>Período ${indice + 1}</h4><p class="data-texto">${formataData(periodo.inicio)} até ${formataData(periodo.fim)}</p></div><strong>${dinheiro(totalPeriodo(periodo))}</strong></div>${lista}<div class="summary-period-total"><span>Pago: ${dinheiro(pagoPeriodo)}</span><span>Pendente: ${dinheiro(pendentePeriodo)}</span></div></article>`;
  }).join('') : '<div class="empty-state">Nenhum período criado.</div>';

  $('resumo').innerHTML = `
    <div class="summary-title"><span class="section-kicker">ETAPA 03</span><h2 id="titulo-resumo">Visão geral</h2><p>Uma leitura clara da sua renda e das despesas registradas.</p></div>
    <div class="metric-grid summary-metrics">
      <article class="metric-card"><span>Renda disponível</span><strong>${dinheiro(estado.salario)}</strong></article>
      <article class="metric-card"><span>Total planejado</span><strong>${dinheiro(planejado)}</strong></article>
      <article class="metric-card"><span>Já pago</span><strong>${dinheiro(pago)}</strong></article>
      <article class="metric-card metric-highlight"><span>Saldo disponível</span><strong>${dinheiro(saldo)}</strong></article>
    </div>
    <div class="budget-panel"><div class="budget-heading"><span>Orçamento utilizado</span><strong>${Math.round(Math.max(0, (planejado / (estado.salario || 1)) * 100))}%</strong></div><div class="progresso"><div class="${saldo < 0 ? 'estourou' : ''}" style="width:${percentual}%"></div></div><p class="notice ${tipo}">${texto}</p><p class="summary-pending">Ainda falta pagar: <strong>${dinheiro(pendente)}</strong></p></div>
    <section class="summary-section"><h3>Despesas por categoria</h3><div class="category-list">${htmlCategorias}</div></section>
    <section class="summary-section"><h3>Detalhamento por período</h3>${htmlPeriodos}</section>`;
}

/* Exportação e restauração */
function baixarArquivo(conteudo, nome, tipo) {
  const arquivo = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarBackup() {
  const conteudo = JSON.stringify({ ...estado, exportadoEm: new Date().toISOString(), aplicativo: 'AUGUSTO | FINANÇAS' }, null, 2);
  baixarArquivo(conteudo, `augusto-financas-backup-${hoje()}.json`, 'application/json;charset=utf-8');
}

function csvCelula(valor) {
  return '"' + String(valor == null ? '' : valor).replace(/"/g, '""') + '"';
}

function exportarCSV() {
  const linhas = [['Período', 'Data inicial', 'Data final', 'Descrição', 'Categoria', 'Valor (R$)', 'Situação']];
  estado.periodos.forEach((periodo, indice) => {
    periodo.itens.forEach((item) => {
      linhas.push([
        `Período ${indice + 1}`,
        formataData(periodo.inicio),
        formataData(periodo.fim),
        item.nome,
        item.categoria,
        item.valor.toFixed(2).replace('.', ','),
        STATUS[item.status]
      ]);
    });
  });
  const csv = '\uFEFF' + linhas.map((linha) => linha.map(csvCelula).join(';')).join('\r\n');
  baixarArquivo(csv, `augusto-financas-${hoje()}.csv`, 'text/csv;charset=utf-8');
}

function importarBackup(arquivo) {
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const importado = normalizarEstado(JSON.parse(String(leitor.result || '')));
      if (!importado) throw new Error('Estrutura inválida');
      if (!window.confirm('Restaurar este backup vai substituir o planejamento atual. Deseja continuar?')) return;
      estado = importado;
      salvar();
      ir(estado.salario > 0 ? 'planejar' : 'salario');
    } catch (erro) {
      window.alert('Não foi possível restaurar o arquivo. Selecione um backup JSON válido deste painel.');
    } finally {
      $('arquivo-backup').value = '';
    }
  };
  leitor.onerror = () => {
    window.alert('O arquivo não pôde ser lido. Tente selecionar o backup novamente.');
    $('arquivo-backup').value = '';
  };
  leitor.readAsText(arquivo);
}

/* Eventos gerais */
document.querySelectorAll('.menu button').forEach((botao) => {
  botao.addEventListener('click', () => {
    const alvo = botao.dataset.go;
    if (telaAtual === 'salario' && alvo !== 'salario' && !confirmaSalario()) return;
    ir(alvo);
  });
});

$('salario').addEventListener('input', (evento) => {
  estado.salario = numero(evento.target.value);
  salvar();
  $('erro-salario').hidden = true;
});
$('salario').addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter') $('btn-continuar').click();
});
$('btn-continuar').addEventListener('click', () => {
  if (confirmaSalario()) ir('planejar');
});
$('btn-add-periodo').addEventListener('click', () => {
  estado.periodos.push(novoPeriodo());
  salvar();
  desenharPeriodos();
  const primeiroCampo = $('periodos').querySelector(`[data-p="${estado.periodos[estado.periodos.length - 1].id}"] input[type="date"]`);
  if (primeiroCampo) primeiroCampo.focus();
});
$('btn-ver-resumo').addEventListener('click', () => ir('resumo'));
$('btn-voltar').addEventListener('click', () => ir('planejar'));
$('btn-apagar').addEventListener('click', () => {
  if (!window.confirm('Apagar todos os períodos e despesas salvos neste navegador? Esta ação não pode ser desfeita.')) return;
  estado = { salario: 0, periodos: [] };
  proximoId = 1;
  try {
    localStorage.removeItem(CHAVE);
    atualizarStatusSalvamento(true, 'Planejamento reiniciado');
  } catch (erro) {
    atualizarStatusSalvamento(false, 'Não foi possível apagar os dados salvos');
  }
  ir('salario');
});
$('btn-exportar-csv').addEventListener('click', exportarCSV);
$('btn-backup').addEventListener('click', exportarBackup);
$('btn-importar').addEventListener('click', () => $('arquivo-backup').click());
$('arquivo-backup').addEventListener('change', (evento) => importarBackup(evento.target.files && evento.target.files[0]));
$('btn-imprimir').addEventListener('click', () => window.print());

// Se outra aba alterar o planejamento, avisa sem sobrescrever o que está aberto.
window.addEventListener('storage', (evento) => {
  if (evento.key === CHAVE) {
    atualizarStatusSalvamento(false, 'Há alterações em outra aba. Recarregue para atualizar.');
  }
});

/* Inicialização */
carregar();
ir(estado.salario > 0 ? 'planejar' : 'salario');
