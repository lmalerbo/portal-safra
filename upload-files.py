"""
Portal Safra - Upload de arquivos para GitHub Releases
Uso: python upload-files.py

Necessario: Token do GitHub
  1. Acesse: github.com/settings/tokens/new
  2. Nome: portal-safra
  3. Selecione: repo (escopo completo)
  4. Clique em "Generate token" e copie
"""

import os, json, re, sys, urllib.request, urllib.parse, urllib.error
from pathlib import Path

FILES_PATH  = Path(r"I:\Projetos\EXPORTAÇÃO SAFRA\Colheita\exportacao")
REPO        = "lmalerbo/portal-safra"
RELEASE_TAG = "files"
TOKEN_FILE  = Path(__file__).parent / ".github_token"

# -- Token --
def get_token():
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    token = input("Cole seu GitHub Token (github.com/settings/tokens): ").strip()
    TOKEN_FILE.write_text(token)
    print("Token salvo. Proximas execucoes nao vao pedir novamente.")
    return token

# -- GitHub API --
def api(method, url, data=None, content_type="application/json", raw_data=None):
    headers = {
        "Authorization": f"token {TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "portal-safra",
    }
    body = raw_data or (json.dumps(data).encode() if data else None)
    if body:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()) if r.length != 0 else {}
    except urllib.error.HTTPError as e:
        if e.code == 204:
            return {}
        raise

def get_or_create_release():
    try:
        return api("GET", f"https://api.github.com/repos/{REPO}/releases/tags/{RELEASE_TAG}")
    except urllib.error.HTTPError:
        print("Criando release 'files' no GitHub...")
        return api("POST", f"https://api.github.com/repos/{REPO}/releases", {
            "tag_name": RELEASE_TAG,
            "name": "Arquivos de Colheita",
            "body": "Projetos de exportacao — gerenciado pelo upload-files.py",
        })

def upload_asset(release_id, file_path, existing_names):
    name = file_path.name
    # Remove asset existente com mesmo nome
    for asset in existing_names:
        if asset["name"] == name:
            api("DELETE", f"https://api.github.com/repos/{REPO}/releases/assets/{asset['id']}")
            break
    # Upload
    url = (f"https://uploads.github.com/repos/{REPO}/releases/{release_id}/assets"
           f"?name={urllib.parse.quote(name)}")
    return api("POST", url, raw_data=file_path.read_bytes(), content_type="application/zip")

# -- Main --
TOKEN = get_token()

print("\n=== Portal Safra - Upload de Arquivos ===\n")

if not FILES_PATH.exists():
    sys.exit(f"Pasta nao encontrada: {FILES_PATH}")

zips   = sorted(FILES_PATH.glob("*.zip"))
regex  = re.compile(r"^(\d+)_(.+?)_Exp([12])L\.zip$", re.I)
BASE   = f"https://github.com/{REPO}/releases/download/{RELEASE_TAG}"

print(f"{len(zips)} arquivos em {FILES_PATH}\n")

release    = get_or_create_release()
release_id = release["id"]
existing   = release.get("assets", [])

files_json = []
for i, z in enumerate(zips, 1):
    m = regex.match(z.name)
    if not m:
        continue
    print(f"[{i}/{len(zips)}] {z.name} ({z.stat().st_size // 1024} KB)...")
    upload_asset(release_id, z, existing)
    files_json.append({
        "name":        z.name,
        "farmCode":    m.group(1),
        "farmName":    m.group(2),
        "lineType":    f"{m.group(3)}L",
        "size":        z.stat().st_size,
        "downloadUrl": f"{BASE}/{urllib.parse.quote(z.name)}",
    })

files_json.sort(key=lambda f: f["farmName"])

out = Path(__file__).parent / "public" / "files.json"
out.write_text(json.dumps(files_json, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n{len(files_json)} arquivos salvos em public/files.json")

print("\nPublicando no GitHub Pages...")
os.system("git add public/files.json")
os.system(f'git commit -m "Atualiza lista de projetos ({len(files_json)} arquivos)"')
os.system("git push")

print(f"\n✓ Concluido! Portal atualizado em ~1 minuto.")
print(f"  URL: https://lc4pr1o.github.io/portal-safra/")
