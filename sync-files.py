"""
Sincroniza a lista de arquivos ZIP do SharePoint para data/files.json
Uso: python sync-files.py

Na primeira execucao abre o browser para login Microsoft.
Nao precisa de admin — usa suas proprias credenciais.
"""
import json, re, sys
from pathlib import Path

# --- instala dependencias automaticamente se necessario ---
try:
    import msal, requests
except ImportError:
    import subprocess, site
    print("Instalando dependencias (msal, requests)...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "msal", "requests", "--user", "-q"])
    # adiciona o diretorio do usuario ao path da sessao atual
    sys.path.insert(0, site.getusersitepackages())
    try:
        import msal, requests
    except ImportError:
        print("\nReiniciando o script para carregar os pacotes instalados...")
        import os
        os.execv(sys.executable, [sys.executable] + sys.argv)

# --- configuracao ---
TENANT_ID  = "9e23aa49-070c-41ff-8875-d0cf5489769f"
CLIENT_ID  = "d812f483-7b01-4b6c-87aa-863aef549b8a"
SP_HOST    = "https://uspedracombr.sharepoint.com"
SITE_PATH  = "/sites/EquipeGeotecnologia_Pedra"
FOLDER_SRV = "/sites/EquipeGeotecnologia_Pedra/Shared Documents/Projetos/Colheita/exportacao"
SCOPES     = [f"{SP_HOST}/AllSites.Read"]

OUTPUT     = Path(__file__).parent / "data" / "files.json"

# --- parse do nome do arquivo ---
def parse(name: str):
    m = re.match(r"^(\d+)_(.+?)_Exp([12])L\.zip$", name, re.I)
    if not m:
        return None
    folder_encoded = FOLDER_SRV.replace(" ", "%20")
    download_url = f"{SP_HOST}{folder_encoded}/{requests.utils.quote(name)}?download=1"
    return {
        "name":        name,
        "farmCode":    m.group(1),
        "farmName":    m.group(2),
        "lineType":    f"{m.group(3)}L",
        "downloadUrl": download_url,
    }

# --- autenticacao via device flow (abre browser) ---
def get_token():
    cache_file = Path(__file__).parent / ".token_cache.json"
    cache = msal.SerializableTokenCache()
    if cache_file.exists():
        cache.deserialize(cache_file.read_text())

    app = msal.PublicClientApplication(
        CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{TENANT_ID}",
        token_cache=cache,
    )

    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            cache_file.write_text(cache.serialize())
            return result["access_token"]

    flow = app.initiate_device_flow(scopes=SCOPES)
    print("\n" + "=" * 50)
    print(flow["message"])
    print("=" * 50 + "\n")
    result = app.acquire_token_by_device_flow(flow)

    if "access_token" not in result:
        sys.exit(f"Erro de autenticacao: {result.get('error_description', result)}")

    cache_file.write_text(cache.serialize())
    return result["access_token"]

# --- lista arquivos no SharePoint ---
def list_files(token: str):
    encoded = FOLDER_SRV.replace(" ", "%20")
    url = (
        f"{SP_HOST}{SITE_PATH}/_api/web"
        f"/GetFolderByServerRelativeUrl('{encoded}')/Files"
        f"?$select=Name,Length&$orderby=Name&$top=500"
    )
    r = requests.get(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json;odata=verbose",
    })
    r.raise_for_status()
    return r.json()["d"]["results"]

# --- main ---
def main():
    print("=== Portal Safra — Sincronizacao de Arquivos ===\n")
    token = get_token()
    print("Autenticado! Buscando arquivos no SharePoint...")

    items = list_files(token)
    files = [f for item in items if item["Name"].lower().endswith(".zip")
             if (f := parse(item["Name"])) is not None]
    files.sort(key=lambda f: f["farmName"])

    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(files, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{len(files)} arquivos salvos em data/files.json:\n")
    for f in files:
        print(f"  [{f['lineType']}] {f['farmCode']} — {f['farmName']}")
    print("\nPronto! Reinicie o portal (npm run dev) para ver os arquivos.")

if __name__ == "__main__":
    main()
