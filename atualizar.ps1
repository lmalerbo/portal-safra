# Portal Safra - Atualizar arquivos
# Uso: powershell -ExecutionPolicy Bypass -File atualizar.ps1
#
# O que faz:
#   1. Le os ZIPs da pasta local
#   2. Faz upload para o GitHub Releases (tag: "files")
#   3. Atualiza o public/files.json
#   4. Commita e faz push -> GitHub Pages recompila automaticamente

$FILES_PATH = "I:\Projetos\EXPORTAÇÃO SAFRA\Colheita\exportacao"
$REPO       = "lmalerbo/portal-safra"
$RELEASE    = "files"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n=== Portal Safra - Atualizacao ===" -ForegroundColor Cyan

# Verifica gh CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "GitHub CLI nao encontrado. Baixe em: https://cli.github.com/" -ForegroundColor Red
    exit 1
}

# Verifica pasta de arquivos
if (-not (Test-Path $FILES_PATH)) {
    Write-Host "Pasta nao encontrada: $FILES_PATH" -ForegroundColor Red
    exit 1
}

# Cria ou atualiza a release "files"
Write-Host "`n[1/4] Preparando GitHub Release..." -ForegroundColor Yellow
gh release view $RELEASE --repo $REPO *>$null
if ($LASTEXITCODE -ne 0) {
    gh release create $RELEASE --repo $REPO --title "Arquivos de Colheita" --notes "Projetos de exportacao de colheita"
}

# Faz upload dos ZIPs
$zips = Get-ChildItem -Path $FILES_PATH -Filter "*.zip"
Write-Host "`n[2/4] Enviando $($zips.Count) arquivos para o GitHub..." -ForegroundColor Yellow
foreach ($zip in $zips) {
    Write-Host "  -> $($zip.Name)"
    gh release upload $RELEASE --repo $REPO --clobber $zip.FullName
}

# Gera files.json
Write-Host "`n[3/4] Gerando files.json..." -ForegroundColor Yellow
$BASE_URL = "https://github.com/$REPO/releases/download/$RELEASE"
$regex    = '^(\d+)_(.+?)_Exp([12])L\.zip$'

$files = foreach ($zip in $zips) {
    if ($zip.Name -match $regex) {
        [PSCustomObject]@{
            name        = $zip.Name
            farmCode    = $Matches[1]
            farmName    = $Matches[2]
            lineType    = "$($Matches[3])L"
            size        = $zip.Length
            downloadUrl = "$BASE_URL/$([Uri]::EscapeDataString($zip.Name))"
        }
    }
}
$files = $files | Sort-Object farmName

$jsonPath = Join-Path $SCRIPT_DIR "public\files.json"
$files | ConvertTo-Json -Depth 3 | Set-Content -Path $jsonPath -Encoding UTF8
Write-Host "  $($files.Count) arquivos salvos em public/files.json"

# Commit e push
Write-Host "`n[4/4] Publicando no GitHub Pages..." -ForegroundColor Yellow
Set-Location $SCRIPT_DIR
git add public/files.json
git commit -m "Atualiza lista de projetos ($($files.Count) arquivos)"
git push

Write-Host "`n✓ Concluido! O portal sera atualizado em ~1 minuto." -ForegroundColor Green
Write-Host "  Acesse: https://lc4pr1o.github.io/portal-safra/" -ForegroundColor Cyan
