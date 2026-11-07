// Valida os arquivos JSON de dados/ e, se estiver tudo certo, gera dados/radar.js, que é o que a página lê.
// Uso:
//   node scripts/gerar.mjs              valida e atualiza a página
//   node scripts/gerar.mjs --restaurar  desfaz estragos: recria os JSON de dados/ a partir da última versão boa (dados/radar.js)
//   node scripts/gerar.mjs --zerar-historico=id1,id2  aceita que dias antigos sumam do histórico desses produtos (só a pedido do dono)
import { readFileSync, writeFileSync, renameSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { RAIZ, ARQ_PAGINA, PREFIXO, lerRadarJs } from "./comum.mjs";

const json = (rel) => JSON.parse(readFileSync(join(RAIZ, rel), "utf8"));
const escrever = (rel, obj) => {
  const caminho = join(RAIZ, rel);
  mkdirSync(join(caminho, ".."), { recursive: true });
  writeFileSync(caminho, JSON.stringify(obj, null, 2) + "\n", "utf8");
};

if (process.argv.includes("--restaurar")) {
  const R = lerRadarJs();
  if (!R) { console.error("Não existe dados/radar.js para restaurar."); process.exit(1); }
  escrever("dados/config.json", R.config);
  for (const [id, dados] of Object.entries(R.precos || {})) escrever(`dados/precos/${id}.json`, dados);
  if (R.livelo) escrever("dados/livelo.json", R.livelo);
  console.log(`Arquivos de dados/ restaurados a partir da versão de ${R.gerado}.`);
  process.exit(0);
}

// 1) Validar. Se falhar, a página continua com a última versão boa.
const v = spawnSync(process.execPath, [join(RAIZ, "scripts", "validar.mjs"), ...process.argv.slice(2)], { stdio: "inherit" });
if (v.status !== 0) {
  console.error("\nA página NÃO foi atualizada. Corrija os dados e rode de novo.");
  process.exit(1);
}

// 2) Juntar tudo num só arquivo que a página carrega (funciona abrindo o index.html direto da pasta).
const config = json("dados/config.json");
const precos = {};
for (const p of config.produtos) precos[p.id] = json(`dados/precos/${p.id}.json`);
const radar = {
  gerado: new Date().toISOString(),
  config,
  precos,
  livelo: existsSync(join(RAIZ, "dados/livelo.json")) ? json("dados/livelo.json") : null,
};

const texto = "// Gerado por scripts/gerar.mjs. Não edite à mão: edite os arquivos JSON de dados/ e rode o script.\n"
  + PREFIXO + JSON.stringify(radar) + ";\n";

// Guarda a versão anterior e troca o arquivo de uma vez, para a página nunca ler um arquivo pela metade.
if (existsSync(ARQ_PAGINA)) copyFileSync(ARQ_PAGINA, join(RAIZ, "dados", "radar.anterior.js"));
const tmp = ARQ_PAGINA + ".tmp";
writeFileSync(tmp, texto, "utf8");
renameSync(tmp, ARQ_PAGINA);
console.log("Página atualizada: dados/radar.js");
