// app.js — frontend do Painel Comercial (Atlas)

let produtos = [], clientes = [], pedidos = [];
let itensForm = []; // itens do pedido em construção
let chartFat = null, chartTop = null;

const $ = s => document.querySelector(s);
const brl = n => "R$ " + (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const esc = s => String(s || "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

async function api(path, options = {}) {
  const res = await fetch("/api/" + path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok && res.status !== 204) {
    const erro = await res.json().catch(() => ({}));
    throw new Error(erro.erro || "Erro na requisição.");
  }
  return res.status === 204 ? null : res.json();
}

// ---------- navegação ----------
document.querySelectorAll(".side nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".side nav button").forEach(x => x.classList.toggle("on", x === b));
  ["dash", "prod", "cli", "ped", "fat"].forEach(id => $("#" + id).hidden = id !== b.dataset.t);
  if (b.dataset.t === "dash") carregarDashboard();
});

// ============ PRODUTOS ============
$("#fp").onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  const payload = { nome: f.nome.value.trim(), categoria: f.categoria.value.trim(), preco: Number(f.preco.value) || 0, estoque: Number(f.estoque.value) || 0 };
  if (!payload.nome) return;
  try { produtos.push(await api("produtos", { method: "POST", body: JSON.stringify(payload) })); f.reset(); renderProdutos(); renderSelects(); }
  catch (e) { alert(e.message); }
};
async function delProduto(id) {
  produtos = produtos.filter(p => p.id !== id); renderProdutos(); renderSelects();
  try { await api("produtos/" + id, { method: "DELETE" }); } catch (e) { alert(e.message); }
}
function renderProdutos() {
  $("#ep").hidden = produtos.length > 0;
  $("#tp").innerHTML = produtos.map(p => `<tr><td><strong>${esc(p.nome)}</strong></td><td>${esc(p.categoria) || "—"}</td>
    <td class="num">${brl(p.preco)}</td><td class="num">${p.estoque}</td>
    <td><button class="x" data-del-p="${p.id}">Excluir</button></td></tr>`).join("");
}

// ============ CLIENTES ============
$("#fc").onsubmit = async e => {
  e.preventDefault(); const f = e.target;
  const payload = { nome: f.nome.value.trim(), empresa: f.empresa.value.trim(), email: f.email.value.trim(), fone: f.fone.value.trim() };
  if (!payload.nome) return;
  try { clientes.push(await api("clientes", { method: "POST", body: JSON.stringify(payload) })); f.reset(); renderClientes(); renderSelects(); }
  catch (e) { alert(e.message); }
};
async function delCliente(id) {
  clientes = clientes.filter(c => c.id !== id); renderClientes(); renderSelects();
  try { await api("clientes/" + id, { method: "DELETE" }); } catch (e) { alert(e.message); }
}
function renderClientes() {
  $("#ec").hidden = clientes.length > 0;
  $("#tc").innerHTML = clientes.map(c => {
    const q = pedidos.filter(p => p.clienteId === c.id).length;
    const ct = [c.email, c.fone].filter(Boolean).join(" · ") || "—";
    return `<tr><td><strong>${esc(c.nome)}</strong></td><td>${esc(c.empresa) || "—"}</td><td>${esc(ct)}</td>
      <td class="num">${q}</td><td><button class="x" data-del-c="${c.id}">Excluir</button></td></tr>`;
  }).join("");
}

// ============ SELECTS COMPARTILHADOS ============
function renderSelects() {
  $("#selCliente").innerHTML = clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("") || '<option value="">Cadastre um cliente primeiro</option>';
  $("#fCliente").innerHTML = '<option value="">Todos</option>' + clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("");
}

// ============ PEDIDOS: montagem de itens ============
function linhaItem(idx) {
  const opts = produtos.map(p => `<option value="${p.id}">${esc(p.nome)} — ${brl(p.preco)}</option>`).join("");
  return `<div class="item-row" data-idx="${idx}">
    <div><label>Produto</label><select class="it-prod">${opts || '<option value="">Cadastre um produto</option>'}</select></div>
    <div><label>Qtd.</label><input class="it-qtd" type="number" min="1" value="1"></div>
    <div><label class="sub">Subtotal</label><div class="num it-sub" style="padding:8px 0">R$ 0</div></div>
    <button class="x" type="button" data-rm-item="${idx}">Remover</button>
  </div>`;
}
function redesenharItens() {
  $("#itensPedido").innerHTML = itensForm.map((_, i) => linhaItem(i)).join("");
  document.querySelectorAll("#itensPedido .item-row").forEach(row => {
    const idx = +row.dataset.idx;
    const sel = row.querySelector(".it-prod"), qtd = row.querySelector(".it-qtd");
    sel.value = itensForm[idx].produtoId || sel.value;
    qtd.value = itensForm[idx].quantidade || 1;
    const atualizar = () => {
      itensForm[idx].produtoId = sel.value;
      itensForm[idx].quantidade = Math.max(1, Number(qtd.value) || 1);
      const p = produtos.find(x => x.id === sel.value);
      const sub = p ? p.preco * itensForm[idx].quantidade : 0;
      row.querySelector(".it-sub").textContent = brl(sub);
      atualizarTotalPedido();
    };
    sel.onchange = atualizar; qtd.oninput = atualizar; atualizar();
  });
}
function atualizarTotalPedido() {
  const total = itensForm.reduce((sum, it) => {
    const p = produtos.find(x => x.id === it.produtoId);
    return sum + (p ? p.preco * it.quantidade : 0);
  }, 0);
  $("#totalPedido").textContent = brl(total);
}
$("#addItem").onclick = () => {
  if (!produtos.length) { alert("Cadastre ao menos um produto antes de montar um pedido."); return; }
  itensForm.push({ produtoId: produtos[0].id, quantidade: 1 });
  redesenharItens(); atualizarTotalPedido();
};
document.addEventListener("click", e => {
  const rm = e.target.dataset.rmItem;
  if (rm !== undefined) { itensForm.splice(+rm, 1); redesenharItens(); atualizarTotalPedido(); }
});

$("#salvarPedido").onclick = async () => {
  const f = $("#fped");
  if (!f.clienteId.value) return alert("Selecione um cliente.");
  if (!itensForm.length) return alert("Adicione ao menos um item ao pedido.");
  const payload = {
    clienteId: f.clienteId.value,
    data: f.data.value || undefined,
    status: f.status.value,
    itens: itensForm.map(it => ({ produtoId: it.produtoId, quantidade: it.quantidade }))
  };
  try {
    const criado = await api("pedidos", { method: "POST", body: JSON.stringify(payload) });
    pedidos.unshift(criado);
    itensForm = []; redesenharItens(); atualizarTotalPedido();
    f.reset();
    await carregarProdutos(); // estoque mudou
    renderClientes(); renderPedidosFiltrados(); renderFaturamento();
  } catch (e) { alert(e.message); }
};

// ============ PEDIDOS: listagem e filtros ============
$("#filtrar").onclick = () => renderPedidosFiltrados(true);

async function renderPedidosFiltrados(buscarDoServidor) {
  let lista = pedidos;
  if (buscarDoServidor) {
    const qs = new URLSearchParams();
    if ($("#fStatus").value) qs.set("status", $("#fStatus").value);
    if ($("#fCliente").value) qs.set("clienteId", $("#fCliente").value);
    if ($("#fDe").value) qs.set("de", $("#fDe").value);
    if ($("#fAte").value) qs.set("ate", $("#fAte").value);
    lista = await api("pedidos?" + qs.toString());
  }
  $("#eped").hidden = lista.length > 0;
  $("#tped").innerHTML = lista.map(p => linhaPedido(p)).join("");
}
function linhaPedido(p) {
  const c = clientes.find(x => x.id === p.clienteId);
  const total = p.itens.reduce((s, it) => s + it.precoUnit * it.quantidade, 0);
  const resumoItens = p.itens.map(it => `${it.quantidade}× ${esc(it.nome)}`).join(", ");
  const cls = p.status === "Faturado" ? "faturado" : p.status === "Cancelado" ? "cancelado" : "";
  return `<tr><td class="num">${p.data}</td><td>${c ? esc(c.nome) : "—"}</td><td>${resumoItens}</td>
    <td class="num">${brl(total)}</td>
    <td><select data-st="${p.id}" style="width:auto;display:inline-block;font-size:.78rem;padding:3px 6px">
      ${["Pendente", "Faturado", "Cancelado"].map(s => `<option${s === p.status ? " selected" : ""}>${s}</option>`).join("")}
    </select> <span class="status ${cls}" style="margin-left:6px">${p.status}</span></td>
    <td><button class="x" data-del-ped="${p.id}">Excluir</button></td></tr>`;
}
document.addEventListener("change", async e => {
  if (e.target.dataset.st) {
    const id = e.target.dataset.st, status = e.target.value;
    try {
      const atualizado = await api("pedidos/" + id, { method: "PUT", body: JSON.stringify({ status }) });
      pedidos = pedidos.map(p => p.id === id ? atualizado : p);
      await carregarProdutos();
      renderPedidosFiltrados(); renderFaturamento(); carregarDashboard();
    } catch (e) { alert(e.message); }
  }
});
async function delPedido(id) {
  try {
    await api("pedidos/" + id, { method: "DELETE" });
    pedidos = pedidos.filter(p => p.id !== id);
    await carregarProdutos();
    renderClientes(); renderPedidosFiltrados(); renderFaturamento(); carregarDashboard();
  } catch (e) { alert(e.message); }
}

document.addEventListener("click", e => {
  const dp = e.target.dataset.delP, dc = e.target.dataset.delC, dped = e.target.dataset.delPed;
  if (dp && confirm("Excluir este produto?")) delProduto(dp);
  if (dc && confirm("Excluir este cliente?")) delCliente(dc);
  if (dped && confirm("Excluir este pedido? O estoque será devolvido.")) delPedido(dped);
});

// ============ FATURAMENTO ============
function renderFaturamento() {
  const faturados = pedidos.filter(p => p.status === "Faturado");
  const totais = faturados.map(p => p.itens.reduce((s, it) => s + it.precoUnit * it.quantidade, 0));
  const total = totais.reduce((a, b) => a + b, 0);
  $("#f1").textContent = brl(total);
  $("#f2").textContent = faturados.length;
  $("#f3").textContent = brl(faturados.length ? total / faturados.length : 0);
  $("#efat").hidden = faturados.length > 0;
  $("#tfat").innerHTML = faturados.map(p => {
    const c = clientes.find(x => x.id === p.clienteId);
    const t = p.itens.reduce((s, it) => s + it.precoUnit * it.quantidade, 0);
    const resumo = p.itens.map(it => `${it.quantidade}× ${esc(it.nome)}`).join(", ");
    return `<tr><td class="num">${p.data}</td><td>${c ? esc(c.nome) : "—"}</td><td>${resumo}</td><td class="num">${brl(t)}</td></tr>`;
  }).join("");
}

// ============ DASHBOARD / GRÁFICOS ============
async function carregarDashboard() {
  let d;
  try { d = await api("dashboard"); } catch (e) { return; }
  $("#k1").textContent = brl(d.faturamentoTotal);
  $("#k2").textContent = brl(d.ticketMedio);
  $("#k3").textContent = d.pedidosPendentes;
  $("#k4").textContent = d.totalProdutos;

  const corPine = getComputedStyle(document.documentElement).getPropertyValue("--pine-2").trim() || "#2c4f38";
  const labelsMes = d.porMes.map(m => {
    const [y, mo] = m.mes.split("-");
    return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][+mo - 1] + "/" + y.slice(2);
  });

  if (chartFat) chartFat.destroy();
  chartFat = new Chart($("#graf1"), {
    type: "bar",
    data: { labels: labelsMes, datasets: [{ label: "Faturamento", data: d.porMes.map(m => m.valor), backgroundColor: corPine }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  if (chartTop) chartTop.destroy();
  chartTop = new Chart($("#graf2"), {
    type: "bar",
    data: { labels: d.topProdutos.map(p => p.nome), datasets: [{ label: "Unidades vendidas", data: d.topProdutos.map(p => p.quantidade), backgroundColor: corPine }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
  });
}

// ============ carga inicial ============
async function carregarProdutos() { produtos = await api("produtos"); renderProdutos(); renderSelects(); redesenharItens(); }

async function carregarTudo() {
  try {
    [produtos, clientes, pedidos] = await Promise.all([api("produtos"), api("clientes"), api("pedidos")]);
    $("#foot").textContent = "Conectado (Vercel + Redis).";
  } catch (e) {
    $("#foot").textContent = "Não foi possível conectar ao servidor.";
    console.error(e);
  }
  renderProdutos(); renderClientes(); renderSelects();
  renderPedidosFiltrados(); renderFaturamento();
  carregarDashboard();
}
carregarTudo();
