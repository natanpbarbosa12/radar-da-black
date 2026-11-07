// Confere se os arquivos de dados/ estão no formato que a página espera.
// Uso: node scripts/validar.mjs   (termina com "OK" ou lista os erros e sai com código 1)
// Normalmente você não roda este script sozinho: o scripts/gerar.mjs já roda ele antes de atualizar a página.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RAIZ, lerRadarJs } from "./comum.mjs";

const erros = [];
const avisos = [];
const erro = (arq, msg) => erros.push(`${arq}: ${msg}`);
const aviso = (arq, msg) => avisos.push(`${arq}: ${msg}`);

// --zerar-historico=id1,id2: só quando o dono pede numa conversa. Nunca use na coleta diária.
const zerarHistorico = new Set(process.argv.filter((a) => a.startsWith("--zerar-historico=")).flatMap((a) => a.split("=")[1].split(",")).filter(Boolean));
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const ehData = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const ehMes = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const ehPreco = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e6;
const ehTexto = (v) => typeof v === "string" && v.trim().length > 0;
const ehLink = (v) => typeof v === "string" && /^https:\/\/\S+$/.test(v);
const ehInt = (v) => Number.isInteger(v);
const mediana = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function ler(rel) {
  const caminho = join(RAIZ, rel);
  if (!existsSync(caminho)) { erro(rel, "arquivo não existe"); return null; }
  try { return JSON.parse(readFileSync(caminho, "utf8")); }
  catch (e) { erro(rel, "JSON inválido (" + e.message + ")"); return null; }
}

// Última versão aprovada (dados/radar.js), para garantir que o histórico antigo não foi apagado.
let ultimaBoa;
try { ultimaBoa = lerRadarJs(); }
catch (e) { avisos.push("dados/radar.js: não deu para ler a última versão boa (" + e.message + ")"); ultimaBoa = null; }
const versaoAnterior = (id) => ultimaBoa?.precos?.[id] ?? null;

function oferta(rel, o, onde, exigeVendedor) {
  if (!o || typeof o !== "object") { erro(rel, `${onde} não é um objeto`); return; }
  if (!ehTexto(o.loja)) erro(rel, `${onde}.loja vazio`);
  if (!ehTexto(o.nome)) erro(rel, `${onde}.nome vazio`);
  if (!ehPreco(o.preco)) erro(rel, `${onde}.preco inválido (${o.preco})`);
  if (o.link != null && !ehLink(o.link)) erro(rel, `${onde}.link precisa começar com https:// (${o.link})`);
  const v = o.vendedor;
  if (v == null) { if (exigeVendedor) erro(rel, `${onde}.vendedor obrigatório: confira quem vende antes de aceitar a oferta`); return; }
  if (typeof v !== "object" || !ehTexto(v.nome)) { erro(rel, `${onde}.vendedor.nome vazio`); return; }
  if (v.tipo !== "loja" && v.tipo !== "parceiro") { erro(rel, `${onde}.vendedor.tipo precisa ser "loja" ou "parceiro"`); return; }
  if (v.nota != null && !(typeof v.nota === "number" && v.nota >= 0 && v.nota <= 5)) erro(rel, `${onde}.vendedor.nota precisa ser de 0 a 5`);
  if (v.avaliacoes != null && (!ehInt(v.avaliacoes) || v.avaliacoes < 0)) erro(rel, `${onde}.vendedor.avaliacoes precisa ser um número inteiro`);
  if (v.reputacao != null && !["verde", "amarelo", "laranja", "vermelho"].includes(v.reputacao)) erro(rel, `${onde}.vendedor.reputacao inválida (${v.reputacao})`);
  if (v.tipo === "parceiro") {
    if (v.nota == null && v.reputacao == null) erro(rel, `${onde}: vendedor parceiro sem nota nem reputação. Na dúvida, descarte a oferta.`);
    if (v.nota != null && v.nota < VEND.notaMinima) erro(rel, `${onde}: vendedor ${v.nome} com nota ${v.nota} (mínimo ${VEND.notaMinima}). Descarte a oferta.`);
    if (v.reputacao != null && v.reputacao !== "verde") erro(rel, `${onde}: vendedor ${v.nome} com reputação ${v.reputacao}. Descarte a oferta.`);
    if (!ehInt(v.avaliacoes) || v.avaliacoes < VEND.avaliacoesMinimas) erro(rel, `${onde}: vendedor ${v.nome} com ${v.avaliacoes ?? "?"} avaliações (mínimo ${VEND.avaliacoesMinimas}). Descarte a oferta.`);
  }
}

// ---------- config ----------
const cfg = ler("dados/config.json");
const produtos = Array.isArray(cfg?.produtos) ? cfg.produtos : [];
const VEND = { notaMinima: 4, avaliacoesMinimas: 100, exigirDesde: "2026-10-23", ...(cfg?.vendedor || {}) };
if (cfg?.vendedor != null) {
  if (!(typeof VEND.notaMinima === "number" && VEND.notaMinima >= 0 && VEND.notaMinima <= 5)) erro("dados/config.json", "vendedor.notaMinima precisa ser de 0 a 5");
  if (!ehInt(VEND.avaliacoesMinimas) || VEND.avaliacoesMinimas < 0) erro("dados/config.json", "vendedor.avaliacoesMinimas precisa ser inteiro");
  if (!ehData(VEND.exigirDesde)) erro("dados/config.json", "vendedor.exigirDesde precisa ser AAAA-MM-DD");
}
if (cfg) {
  if (!ehData(cfg.blackFriday)) erro("dados/config.json", "blackFriday precisa ser AAAA-MM-DD");
  if (!produtos.length) erro("dados/config.json", "lista produtos vazia");
  const ids = new Set();
  produtos.forEach((p, i) => {
    if (!p || !/^[a-z0-9_-]+$/i.test(p.id || "")) erro("dados/config.json", `produtos[${i}].id inválido`);
    if (ids.has(p.id)) erro("dados/config.json", `id repetido: ${p.id}`);
    ids.add(p.id);
    for (const k of ["cat", "nome", "modelo"]) if (!ehTexto(p[k])) erro("dados/config.json", `produtos[${i}].${k} vazio`);
  });
}

// ---------- preços ----------
for (const p of produtos) {
  const rel = `dados/precos/${p.id}.json`;
  const a = ler(rel);
  if (!a) continue;
  if (a.atualizado != null) {
    if (!ehData(a.atualizado)) erro(rel, "atualizado precisa ser AAAA-MM-DD");
    else if (a.atualizado > hoje) erro(rel, `atualizado está no futuro (${a.atualizado})`);
  }
  const ofertas = a.ofertas ?? [];
  if (!Array.isArray(ofertas)) erro(rel, "ofertas precisa ser uma lista");
  else {
    const exige = ehData(a.atualizado) && a.atualizado >= VEND.exigirDesde;
    ofertas.forEach((o, i) => oferta(rel, o, `ofertas[${i}]`, exige));
    for (let i = 1; i < ofertas.length; i++) if (ofertas[i].preco < ofertas[i - 1].preco) { erro(rel, "ofertas fora de ordem de preço"); break; }
    const nc = a.naoConferidas ?? [];
    if (!Array.isArray(nc)) erro(rel, "naoConferidas precisa ser uma lista");
    else nc.forEach((o, i) => { oferta(rel, { ...o, vendedor: undefined }, `naoConferidas[${i}]`, false); });
    if (a.qtdOfertas != null && (!ehInt(a.qtdOfertas) || a.qtdOfertas < ofertas.length)) erro(rel, "qtdOfertas menor que o número de ofertas");
  }
  if (a.menor != null) {
    oferta(rel, a.menor, "menor", ehData(a.atualizado) && a.atualizado >= VEND.exigirDesde);
    if (Array.isArray(ofertas) && ofertas.length && a.menor.preco !== ofertas[0].preco) erro(rel, "menor.preco diferente de ofertas[0].preco");
  } else if (Array.isArray(ofertas) && ofertas.length) erro(rel, "menor está vazio mas há ofertas");

  const hist = a.historico ?? [];
  if (!Array.isArray(hist)) erro(rel, "historico precisa ser uma lista");
  else {
    let antes = "";
    hist.forEach((h, i) => {
      const onde = `historico[${i}]`;
      if (!ehData(h?.d)) { erro(rel, `${onde}.d inválido`); return; }
      if (h.d <= antes) erro(rel, `${onde}: datas repetidas ou fora de ordem (${h.d})`);
      if (h.d > hoje) erro(rel, `${onde}: data no futuro (${h.d})`);
      antes = h.d;
      if (!ehPreco(h.p)) erro(rel, `${onde}.p inválido`);
      if (h.l != null && !ehTexto(h.l)) erro(rel, `${onde}.l vazio`);
      if (h.lojas != null && (!ehInt(h.lojas) || h.lojas < 1)) erro(rel, `${onde}.lojas inválido`);
      if (h.m != null && (!ehPreco(h.m) || h.m + 0.01 < h.p)) erro(rel, `${onde}.m precisa ser um preço maior ou igual a p`);
    });
    if (a.menor && hist.length && a.atualizado && hist[hist.length - 1].d === a.atualizado && Math.abs(hist[hist.length - 1].p - a.menor.preco) > 0.005) {
      erro(rel, "o registro de hoje no historico não bate com menor.preco");
    }
    // O histórico anterior precisa continuar igual (só o dia de hoje pode mudar),
    // a não ser que o dono tenha pedido para zerar o histórico deste produto (--zerar-historico=id).
    const anterior = versaoAnterior(p.id);
    if (anterior && Array.isArray(anterior.historico) && !zerarHistorico.has(p.id)) {
      const atual = new Map(hist.map((h) => [h.d, h]));
      for (const h of anterior.historico) {
        if (h.d === hoje) continue;
        const x = atual.get(h.d);
        if (!x) erro(rel, `o dia ${h.d} sumiu do historico`);
        else if (Math.abs(x.p - h.p) > 0.005) erro(rel, `o preço do dia ${h.d} foi alterado (${h.p} → ${x.p})`);
      }
    }
    // Queda ou alta muito grande só gera aviso (pode ser promoção de verdade).
    const passados = hist.filter((h) => h.d !== a.atualizado).slice(-14).map((h) => h.p);
    if (a.menor && passados.length) {
      const ref = mediana(passados), r = a.menor.preco / ref;
      if (r < 0.5 || r > 2) aviso(rel, `preço de hoje (${a.menor.preco}) muito diferente do normal recente (${ref}). Confira se é o modelo certo.`);
    }
  }
  const meses = a.meses ?? [];
  if (!Array.isArray(meses)) erro(rel, "meses precisa ser uma lista");
  else meses.forEach((m, i) => {
    if (!ehMes(m?.m)) erro(rel, `meses[${i}].m precisa ser AAAA-MM`);
    if (![m?.min, m?.med, m?.max].every(ehPreco)) erro(rel, `meses[${i}] precisa de min, med e max`);
    else if (!(m.min <= m.med && m.med <= m.max)) erro(rel, `meses[${i}]: precisa min ≤ med ≤ max`);
  });
}

// ---------- livelo ----------
{
  const rel = "dados/livelo.json";
  const lv = ler(rel);
  if (lv) {
    if (!ehData(lv.atualizado)) erro(rel, "atualizado precisa ser AAAA-MM-DD");
    if (!Array.isArray(lv.lojas) || !lv.lojas.length) erro(rel, "lojas precisa ser uma lista");
    else lv.lojas.forEach((l, i) => {
      const onde = `lojas[${i}]`;
      if (!ehTexto(l?.loja)) erro(rel, `${onde}.loja vazio`);
      for (const k of ["pontos", "normal", "clube"]) if (l?.[k] != null && !(typeof l[k] === "number" && l[k] >= 0 && l[k] <= 100)) erro(rel, `${onde}.${k} inválido`);
      if (typeof l?.pontos !== "number") erro(rel, `${onde}.pontos obrigatório`);
      if (typeof l?.promocao !== "boolean") erro(rel, `${onde}.promocao precisa ser true ou false`);
      if (l?.regra != null && typeof l.regra !== "string") erro(rel, `${onde}.regra precisa ser texto`);
    });
    // Bônus para transferir pontos da Livelo: Smiles (GOL), Azul Fidelidade e LATAM Pass.
    for (const k of ["smiles", "azul", "latam"]) {
      const s = lv[k];
      if (s == null) continue;
      if (typeof s.ativa !== "boolean") { erro(rel, `${k}.ativa precisa ser true ou false`); continue; }
      if (s.ativa) {
        if (!(typeof s.bonus === "number" && s.bonus > 0 && s.bonus <= 300)) erro(rel, `${k}.bonus inválido`);
        if (s.titulo != null && typeof s.titulo !== "string") erro(rel, `${k}.titulo precisa ser texto`);
        if (s.regras != null && !Array.isArray(s.regras)) erro(rel, `${k}.regras precisa ser uma lista`);
        if (s.cadastro != null && !ehLink(s.cadastro)) erro(rel, `${k}.cadastro precisa começar com https://`);
      }
    }
  }
}

for (const a of avisos) console.log("Aviso: " + a);
if (erros.length) {
  console.error(`\n${erros.length} erro(s) nos dados:`);
  for (const e of erros) console.error(" - " + e);
  process.exit(1);
}
console.log("OK");
