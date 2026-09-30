// lib/store.js — armazenamento das sessões
// Em produção (Vercel): Upstash Redis, definido pelas variáveis de ambiente
// UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.
// Sem essas variáveis (teste local com `npm run dev`): guarda em memória,
// só para você conferir a lógica antes de fazer o deploy — não persiste
// entre reinícios e não funciona em produção na Vercel (funções são
// descartáveis; memória não é compartilhada entre execuções).

const TTL_SEGUNDOS = 24 * 60 * 60; // sessão expira após 24h sem uso

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const { Redis } = require("@upstash/redis");
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  });
}

const memoria = new Map(); // fallback local

async function obterSessao(sid) {
  if (redis) return await redis.get(`sessao:${sid}`);
  return memoria.get(sid) || null;
}

async function salvarSessao(sid, dados) {
  if (redis) {
    await redis.set(`sessao:${sid}`, dados, { ex: TTL_SEGUNDOS });
  } else {
    memoria.set(sid, dados);
  }
}

module.exports = { obterSessao, salvarSessao, TTL_SEGUNDOS, usandoRedis: () => !!redis };
