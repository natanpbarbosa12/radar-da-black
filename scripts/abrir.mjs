// Abre uma página no Edge (sem janela) e mostra o texto dela. Serve para sites que bloqueiam o WebFetch,
// como a Amazon e os links de oferta do Buscapé (que só levam até a loja com JavaScript).
// Uso: node scripts/abrir.mjs <url> [máximo de caracteres, padrão 12000]
// Saída: JSON com status, endereço final, título, as linhas de "Vendido por" encontradas e o texto da página.
import { chromium } from "playwright-core";

const [url, max = "12000"] = process.argv.slice(2);
if (!/^https:\/\//.test(url || "")) {
  console.error("Uso: node scripts/abrir.mjs https://... [máximo de caracteres]");
  process.exit(1);
}

// No Windows usa o Edge instalado. Fora dele (coleta na nuvem) usa o Chromium do Playwright,
// instalado com: npx playwright-core install --with-deps chromium
const navegador = await chromium.launch(process.platform === "win32" ? { channel: "msedge", headless: true } : { headless: true });
try {
  const ctx = await navegador.newContext({
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
  });
  const pagina = await ctx.newPage();
  const resp = await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  // Links de oferta do Buscapé/Zoom mostram "Estamos te levando para a loja" e só depois vão para a loja.
  if (/(buscape|zoom)\.com\.br\/lead/.test(url)) {
    await pagina.waitForURL((u) => !/(buscape|zoom)\.com\.br/.test(u.hostname), { timeout: 30000 }).catch(() => {});
  }
  await pagina.waitForTimeout(4000);
  const texto = (await pagina.innerText("body")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  // Na Amazon o nome do vendedor fica na linha de baixo de "Vendido por".
  const vendedor = [...new Set((texto.match(/(vendido e entregue por|enviado \/ vendido|vendido por|enviado por)[ :]*\n?[^\n]{0,100}/gi) || []).map((s) => s.replace(/\s+/g, " ").trim()))].slice(0, 10);
  console.log(JSON.stringify({
    status: resp?.status() ?? null,
    url: pagina.url(),
    titulo: await pagina.title(),
    vendedor,
    texto: texto.slice(0, Number(max)),
  }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ erro: e.message }));
  process.exitCode = 1;
} finally {
  await navegador.close();
}
