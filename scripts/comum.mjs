// Funções usadas pelos scripts do radar.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ARQ_PAGINA = join(RAIZ, "dados", "radar.js");
export const PREFIXO = "window.RADAR = ";

// Lê dados/radar.js (a última versão aprovada pelo validador). Devolve null se não existir.
export function lerRadarJs(caminho = ARQ_PAGINA) {
  if (!existsSync(caminho)) return null;
  const txt = readFileSync(caminho, "utf8");
  const ini = txt.indexOf(PREFIXO);
  const fim = txt.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("dados/radar.js está em formato inesperado");
  return JSON.parse(txt.slice(ini + PREFIXO.length, fim + 1));
}
