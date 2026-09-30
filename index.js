// api/index.js — API REST do Painel Comercial, como função serverless da Vercel.
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { obterSessao, salvarSessao, TTL_SEGUNDOS } = require("../lib/store");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, ".."))); // só usado no teste local

const uid = () => crypto.randomBytes(6).toString("hex");
const estadoInicial = () => ({ produtos: [], clientes: [], pedidos: [] });

function lerSid(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)sid=([a-f0-9]{24})/);
  return m ? m[1] : null;
}

app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api")) return next();

  let sid = lerSid(req);
  let sessao = sid ? await obterSessao(sid) : null;

  if (!sessao) {
    sid = crypto.randomBytes(12).toString("hex");
    sessao = estadoInicial();
    await salvarSessao(sid, sessao);
  }
  res.setHeader("Set-Cookie",
    `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SEGUNDOS}${req.secure ? "; Secure" : ""}`);
  req.sid = sid;
  req.s = sessao;
  next();
});
const salvar = req => salvarSessao(req.sid, req.s);

app.post("/api/reset", async (req, res) => {
  req.s = estadoInicial();
  await salvar(req);
  res.json({ ok: true });
});

// ---------- produtos ----------
app.get("/api/produtos", (req, res) => res.json(req.s.produtos));

app.post("/api/produtos", async (req, res) => {
  const { nome, categoria, preco, estoque } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
  const produto = {
    id: uid(), nome: nome.trim(), categoria: categoria || "",
    preco: Number(preco) || 0, estoque: Number.isFinite(Number(estoque)) ? Number(estoque) : 0
  };
  req.s.produtos.push(produto);
  await salvar(req);
  res.status(201).json(produto);
});

app.put("/api/produtos/:id", async (req, res) => {
  const idx = req.s.produtos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Produto não encontrado." });
  req.s.produtos[idx] = { ...req.s.produtos[idx], ...req.body, id: req.params.id };
  await salvar(req);
  res.json(req.s.produtos[idx]);
});

app.delete("/api/produtos/:id", async (req, res) => {
  req.s.produtos = req.s.produtos.filter(p => p.id !== req.params.id);
  await salvar(req);
  res.status(204).end();
});

// ---------- clientes ----------
app.get("/api/clientes", (req, res) => res.json(req.s.clientes));

app.post("/api/clientes", async (req, res) => {
  const { nome, empresa, email, fone } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
  const cliente = { id: uid(), nome: nome.trim(), empresa: empresa || "", email: email || "", fone: fone || "" };
  req.s.clientes.push(cliente);
  await salvar(req);
  res.status(201).json(cliente);
});

app.put("/api/clientes/:id", async (req, res) => {
  const idx = req.s.clientes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Cliente não encontrado." });
  req.s.clientes[idx] = { ...req.s.clientes[idx], ...req.body, id: req.params.id };
  await salvar(req);
  res.json(req.s.clientes[idx]);
});

app.delete("/api/clientes/:id", async (req, res) => {
  req.s.clientes = req.s.clientes.filter(c => c.id !== req.params.id);
  await salvar(req);
  res.status(204).end();
});

// ---------- pedidos ----------
app.get("/api/pedidos", (req, res) => {
  const { status, clienteId, de, ate } = req.query;
  let lista = req.s.pedidos;
  if (status) lista = lista.filter(p => p.status === status);
  if (clienteId) lista = lista.filter(p => p.clienteId === clienteId);
  if (de) lista = lista.filter(p => p.data >= de);
  if (ate) lista = lista.filter(p => p.data <= ate);
  res.json(lista.slice().sort((a, b) => b.data.localeCompare(a.data)));
});

app.post("/api/pedidos", async (req, res) => {
  const { clienteId, itens, data, status } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: "O pedido precisa de ao menos um item." });
  }
  const itensValidados = [];
  for (const it of itens) {
    const produto = req.s.produtos.find(p => p.id === it.produtoId);
    if (!produto) return res.status(400).json({ erro: "Produto inválido em um dos itens." });
    const quantidade = Number(it.quantidade) || 0;
    if (quantidade <= 0) return res.status(400).json({ erro: "Quantidade inválida em um dos itens." });
    itensValidados.push({ produtoId: produto.id, nome: produto.nome, precoUnit: produto.preco, quantidade });
  }
  for (const it of itensValidados) {
    const p = req.s.produtos.find(x => x.id === it.produtoId);
    p.estoque = Math.max(0, (p.estoque || 0) - it.quantidade);
  }
  const pedido = {
    id: uid(), clienteId: clienteId || "", itens: itensValidados,
    data: data || new Date().toISOString().slice(0, 10), status: status || "Pendente"
  };
  req.s.pedidos.push(pedido);
  await salvar(req);
  res.status(201).json(pedido);
});

app.put("/api/pedidos/:id", async (req, res) => {
  const idx = req.s.pedidos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ erro: "Pedido não encontrado." });
  const antes = req.s.pedidos[idx];
  const depois = { ...antes, ...req.body, id: req.params.id, itens: antes.itens };

  if (depois.status === "Cancelado" && antes.status !== "Cancelado") {
    for (const it of antes.itens) {
      const p = req.s.produtos.find(x => x.id === it.produtoId);
      if (p) p.estoque = (p.estoque || 0) + it.quantidade;
    }
  }
  req.s.pedidos[idx] = depois;
  await salvar(req);
  res.json(depois);
});

app.delete("/api/pedidos/:id", async (req, res) => {
  const pedido = req.s.pedidos.find(p => p.id === req.params.id);
  if (pedido && pedido.status !== "Cancelado") {
    for (const it of pedido.itens) {
      const p = req.s.produtos.find(x => x.id === it.produtoId);
      if (p) p.estoque = (p.estoque || 0) + it.quantidade;
    }
  }
  req.s.pedidos = req.s.pedidos.filter(p => p.id !== req.params.id);
  await salvar(req);
  res.status(204).end();
});

// ---------- dashboard ----------
app.get("/api/dashboard", (req, res) => {
  const s = req.s;
  const total = it => it.itens.reduce((sum, x) => sum + x.precoUnit * x.quantidade, 0);

  const faturados = s.pedidos.filter(p => p.status === "Faturado");
  const faturamentoTotal = faturados.reduce((sum, p) => sum + total(p), 0);
  const ticketMedio = faturados.length ? faturamentoTotal / faturados.length : 0;

  const meses = [];
  const d = new Date(); d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const dm = new Date(d.getFullYear(), d.getMonth() - i, 1);
    meses.push(dm.toISOString().slice(0, 7));
  }
  const porMes = meses.map(m => ({
    mes: m,
    valor: faturados.filter(p => p.data.slice(0, 7) === m).reduce((sum, p) => sum + total(p), 0)
  }));

  const qtdPorProduto = {};
  for (const p of s.pedidos) {
    if (p.status === "Cancelado") continue;
    for (const it of p.itens) qtdPorProduto[it.nome] = (qtdPorProduto[it.nome] || 0) + it.quantidade;
  }
  const topProdutos = Object.entries(qtdPorProduto)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nome, quantidade]) => ({ nome, quantidade }));

  res.json({
    totalProdutos: s.produtos.length,
    totalClientes: s.clientes.length,
    totalPedidos: s.pedidos.length,
    pedidosPendentes: s.pedidos.filter(p => p.status === "Pendente").length,
    faturamentoTotal, ticketMedio, porMes, topProdutos
  });
});

module.exports = app;
