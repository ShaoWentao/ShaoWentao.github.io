$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$output = Join-Path $PSScriptRoot 'public'

if (Test-Path -LiteralPath $output) {
    Remove-Item -LiteralPath $output -Recurse -Force
}
New-Item -ItemType Directory -Path $output | Out-Null

$utf8 = New-Object System.Text.UTF8Encoding($false)
$sourceIndex = Join-Path $source 'index.html'
$index = [System.IO.File]::ReadAllText($sourceIndex, $utf8)

# Keep the membership build aligned with the runtime modules declared by the
# application instead of maintaining a second, easily stale hand-written list.
$runtimeAssets = @(
    'index.html'
    [regex]::Matches($index, '<(?:script|link)\b[^>]*(?:src|href)="([^"#?]+\.(?:js|css))') |
        ForEach-Object { $_.Groups[1].Value }
    'styles-original.css'
    'metamer-worker.js'
    'scene-optimizer-worker.js'
    'cie-alpha-opic-action-spectra.csv'
) | Sort-Object -Unique

foreach ($asset in $runtimeAssets) {
    $sourcePath = Join-Path $source $asset
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Required membership asset is missing: $asset"
    }
    $destinationPath = Join-Path $output $asset
    $destinationDirectory = Split-Path -Parent $destinationPath
    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

$sourceAssets = Join-Path $source 'assets'
$outputAssets = Join-Path $output 'assets'
if (-not (Test-Path -LiteralPath $sourceAssets -PathType Container)) {
    throw 'Required membership assets directory is missing.'
}
Copy-Item -LiteralPath $sourceAssets -Destination $outputAssets -Recurse -Force

$missingBuiltAssets = @($runtimeAssets | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $output $_) -PathType Leaf)
})
if ($missingBuiltAssets.Count -gt 0) {
    throw "Membership build is incomplete:`n$($missingBuiltAssets -join "`n")"
}

Write-Host "Prepared $($runtimeAssets.Count) runtime files and the assets directory in $output"
