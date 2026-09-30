// local.js — só para testar antes de dar deploy. A Vercel NÃO usa este
// arquivo; em produção, a própria Vercel chama api/index.js como função.
const app = require("./api/index.js");
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Teste local em http://localhost:${PORT}`));
