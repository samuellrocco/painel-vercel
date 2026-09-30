# Deploy na Vercel com Upstash Redis

Cada sessão de visitante (identificada por um cookie) fica guardada no Redis
em vez de um arquivo local — é isso que faz o isolamento entre visitantes
funcionar em produção na Vercel, já que funções serverless não compartilham
disco entre execuções.

## 1. Criar o banco no Upstash (gratuito)
1. Acesse https://upstash.com e crie uma conta (dá pra usar login do GitHub).
2. Clique em **Create Database**, escolha um nome e a região mais próxima do público-alvo.
3. Na página do banco criado, copie dois valores: **UPSTASH_REDIS_REST_URL** e
   **UPSTASH_REDIS_REST_TOKEN**.

## 2. Subir o projeto para o GitHub
Igual ao que você já fez para o Render: crie um repositório novo e suba todos
os arquivos desta pasta (exceto `node_modules`, se ela existir).

## 3. Criar o projeto na Vercel
1. Acesse https://vercel.com e entre com sua conta do GitHub.
2. **Add New → Project**, selecione o repositório.
3. A Vercel detecta o `vercel.json` e o `api/index.js` sozinha — não precisa
   configurar build command nem output directory.
4. Antes de clicar em Deploy, abra **Environment Variables** e adicione:
   - `UPSTASH_REDIS_REST_URL` = (o valor copiado no passo 1)
   - `UPSTASH_REDIS_REST_TOKEN` = (o valor copiado no passo 1)
5. Clique em **Deploy**.

## 4. Testar
A URL final fica no formato `https://seu-projeto.vercel.app` — bem mais limpa
que a do Render, e sem o "acordar" demorado do plano gratuito.

## Testar localmente antes do deploy (opcional)
```
npm install
npm run dev
```
Sem as variáveis de ambiente do Upstash configuradas, o projeto usa memória
local só para você conferir se a lógica funciona — os dados não persistem
entre reinícios do servidor e isso não é usado em produção.

## O que mudou em relação à versão do Render
- `data/db.json` → sessões guardadas no Upstash Redis (`lib/store.js`)
- `server.js` → virou `api/index.js`, uma função serverless
- HTML/CSS/JS saíram de `public/` e foram para a raiz do projeto (é onde a
  Vercel espera arquivos estáticos por padrão)
- `vercel.json` direciona as chamadas `/api/*` para a função
