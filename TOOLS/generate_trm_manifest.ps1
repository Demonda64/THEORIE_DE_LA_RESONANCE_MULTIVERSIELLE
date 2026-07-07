param(
  [string]$RootPath = "..",
  [string]$OutputPath = "../docs/tree.json"
)

$resolvedRoot = (Resolve-Path $RootPath).Path
$outFile = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) $OutputPath))

$excludePrefixes = @(
  ".git/",
  "docs/"
)

$textExtensions = @(
  ".md", ".txt", ".json", ".yml", ".yaml", ".ps1", ".js", ".css", ".html", ".xml", ".csv"
)

$files = Get-ChildItem -Path $resolvedRoot -Recurse -File

$resultFiles = New-Object System.Collections.Generic.List[object]
$folderSet = New-Object System.Collections.Generic.HashSet[string]

foreach ($file in $files) {
  $baseUri = New-Object System.Uri(($resolvedRoot.TrimEnd('\\') + '\\'))
  $fileUri = New-Object System.Uri($file.FullName)
  $relativePath = [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString()).Replace("\\", "/")

  $skip = $false
  foreach ($prefix in $excludePrefixes) {
    if ($relativePath.StartsWith($prefix)) {
      $skip = $true
      break
    }
  }
  if ($skip) { continue }

  $segments = $relativePath.Split("/")
  $folderParts = @()
  for ($i = 0; $i -lt ($segments.Length - 1); $i++) {
    $folderParts += $segments[$i]
    [void]$folderSet.Add(($folderParts -join "/"))
  }

  $ext = [System.IO.Path]::GetExtension($file.Name).ToLowerInvariant()
  $excerpt = ""

  if ($textExtensions -contains $ext) {
    try {
      $excerpt = ((Get-Content -Path $file.FullName -TotalCount 28) -join "`n").Trim()
      if ($excerpt.Length -gt 900) {
        $excerpt = $excerpt.Substring(0, 900)
      }
    } catch {
      $excerpt = "(Apercu indisponible)"
    }
  }

  $topLevel = if ($segments.Length -gt 1) { $segments[0] } else { "" }

  $resultFiles.Add([pscustomobject]@{
    name = $file.Name
    path = $relativePath
    topLevel = $topLevel
    ext = $ext
    size = [int64]$file.Length
    modified = $file.LastWriteTimeUtc.ToString("o")
    excerpt = $excerpt
  })
}

$folders = @($folderSet) | Sort-Object

$totalBytes = 0
foreach ($item in $resultFiles) {
  $totalBytes += $item.size
}

$payload = [pscustomobject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  repository = "Demonda64/THEORIE_DE_LA_RESONANCE_MULTIVERSIELLE"
  summary = [pscustomobject]@{
    fileCount = $resultFiles.Count
    folderCount = $folders.Count
    totalBytes = $totalBytes
  }
  folders = $folders
  files = $resultFiles
}

$targetDir = Split-Path -Parent $outFile
if (-not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$payload | ConvertTo-Json -Depth 6 | Set-Content -Path $outFile -Encoding utf8
Write-Output "Manifest genere: $outFile"
