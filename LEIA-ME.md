# Radar da Black

Preços dos seus itens para a Black Friday, pontos Livelo e bônus para transferir pontos da Livelo para Smiles, Azul e LATAM. Quem coleta os preços é o Claude, rodando neste PC todo dia.

## Onde ver

Abra o `index.html` desta pasta no navegador (dá para salvar nos favoritos). Se a página já estiver aberta, aperte F5 depois da coleta.

## Como funciona

- Todo dia às 8h e às 20h, o Agendador de Tarefas do Windows roda `scripts/coletar.ps1` (tarefa "Radar da Black").
- O script abre o Claude Code, que segue o `CLAUDE.md`: busca os preços, confere os vendedores, valida os dados e atualiza `dados/radar.js`, que é o que a página mostra.
- O relatório de cada coleta fica em `logs/coleta-AAAA-MM-DD-manha.log` ou `-noite.log`.

O PC precisa estar ligado, com você logado no Windows e com internet às 8h e às 20h. Se estiver desligado, a coleta perdida roda assim que o PC ligar.

## Rodar na mão

Na pasta do radar, no PowerShell:

```
powershell -ExecutionPolicy Bypass -File scripts\coletar.ps1
```

Ou abra o Claude Code nesta pasta e peça: "Faça a coleta diária do Radar da Black".

## Pedir mudanças

Abra o Claude Code nesta pasta e peça em português. Exemplos:

- "Adicione ao radar um monitor LG 27GR75Q."
- "Tire o robô aspirador do radar."

## Se algo der errado

- **A página não mudou:** veja o log do dia em `logs/`. O script barra dados com problema e mantém a última versão boa.
- **Os dados estragaram:** rode `node scripts/gerar.mjs --restaurar`.

## O que tem na pasta

| Arquivo | Para que serve |
|---|---|
| `index.html` | A página do radar. |
| `CLAUDE.md` | As instruções que o Claude segue na coleta. |
| `dados/config.json` | O que é monitorado: produtos, regras de vendedor, data da Black. |
| `dados/precos/*.json` e `dados/livelo.json` | Preços, histórico, pontos Livelo e bônus de transferência (Smiles, Azul, LATAM). |
| `dados/radar.js` | Tudo junto, no formato que a página lê. Gerado pelo script. |
| `scripts/coletar.ps1` | Roda a coleta com o Claude. |
| `scripts/abrir.mjs` | Abre no Edge, sem janela, as páginas que bloqueiam a leitura direta (Amazon, links do Buscapé). |
| `scripts/gerar.mjs` e `scripts/validar.mjs` | Conferem os dados e atualizam a página. |
| `logs/` | O relatório de cada coleta. |
