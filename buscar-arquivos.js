// Cole este script inteiro no console do browser (F12 > Console)
// enquanto estiver com o SharePoint aberto em:
// https://uspedracombr.sharepoint.com/sites/EquipeGeotecnologia_Pedra
//
// O JSON sera copiado automaticamente para o CLIPBOARD.
// Abra data/files.json no VS Code e cole (Ctrl+A, Ctrl+V).

(async () => {
  const FOLDER = "/sites/EquipeGeotecnologia_Pedra/Shared Documents/Projetos/Colheita/exportacao";
  const BASE_URL = "https://uspedracombr.sharepoint.com";
  const ENCODED_FOLDER = FOLDER.replace(/ /g, "%20");

  const url = `/sites/EquipeGeotecnologia_Pedra/_api/web` +
    `/GetFolderByServerRelativeUrl('${ENCODED_FOLDER}')/Files` +
    `?$select=Name,Length&$orderby=Name&$top=500`;

  console.log("Buscando arquivos...");

  const res = await fetch(url, {
    headers: { Accept: "application/json;odata=verbose" },
    credentials: "include",
  });

  if (!res.ok) {
    console.error("Erro:", res.status, res.statusText);
    return;
  }

  const data = await res.json();
  const regex = /^(\d+)_(.+?)_Exp([12])L\.zip$/i;

  const files = data.d.results
    .filter(f => f.Name.toLowerCase().endsWith(".zip"))
    .map(f => {
      const m = f.Name.match(regex);
      if (!m) return null;
      return {
        name: f.Name,
        farmCode: m[1],
        farmName: m[2],
        lineType: m[3] + "L",
        size: parseInt(f.Length || "0", 10),
        downloadUrl: `${BASE_URL}${ENCODED_FOLDER}/${encodeURIComponent(f.Name)}?download=1`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.farmName.localeCompare(b.farmName, "pt-BR"));

  const json = JSON.stringify(files, null, 2);

  // Baixa o arquivo files.json direto para o computador
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "files.json";
  a.click();

  console.log(`✅ ${files.length} arquivos encontrados.`);
  console.log("📥 Arquivo files.json baixado para sua pasta de Downloads!");
  console.log("👉 Substitua o arquivo data/files.json do projeto pelo baixado.");
})();
