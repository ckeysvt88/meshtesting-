param([switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$manifest = Get-Content -Raw -LiteralPath 'manifest.json' | ConvertFrom-Json
$failures = 0
function Get-LocalAssetPath($entry) {
  if ($entry.path -notmatch '^(firmware|software)/[A-Za-z0-9_.+/-]+$' -or $entry.path -match '(^|/)\.\.(/|$)') { throw 'Invalid relative asset path' }
  return Join-Path $PSScriptRoot $entry.path
}
function Test-Asset($path, $entry) {
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw 'File missing' }
  $file = Get-Item -LiteralPath $path
  if ($file.Length -lt 512) { throw 'File is unexpectedly small' }
  $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($entry.sha256 -and ($entry.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $hash -ne $entry.sha256)) { throw 'Reference SHA-256 mismatch' }
  $stream = [IO.File]::OpenRead($file.FullName)
  try {
    $header = New-Object byte[] 8
    [void]$stream.Read($header,0,8)
    switch -Regex ($entry.path) {
      '\.uf2$' {
        if ([BitConverter]::ToUInt32($header,0) -ne 0x0A324655 -or [BitConverter]::ToUInt32($header,4) -ne [Convert]::ToUInt32('9E5D5157',16) -or $file.Length % 512 -ne 0) { throw 'Invalid UF2 header or size' }
        [void]$stream.Seek(-4,[IO.SeekOrigin]::End)
        [void]$stream.Read($header,0,4)
        if ([BitConverter]::ToUInt32($header,0) -ne 0x0AB16F30) { throw 'Invalid UF2 final block' }
      }
      '\.zip$' { if ($header[0] -ne 80 -or $header[1] -ne 75 -or $header[2] -ne 3 -or $header[3] -ne 4) { throw 'Invalid ZIP header' } }
      '\.exe$' { if ($header[0] -ne 77 -or $header[1] -ne 90) { throw 'Invalid Windows executable header' } }
    }
  } finally { $stream.Dispose() }
  return $hash
}
$entries = @($manifest.assets)
$coverage = @{}
if (Test-Path -LiteralPath 'rollback.json' -PathType Leaf) {
  foreach ($row in @(Get-Content -Raw -LiteralPath 'rollback.json' | ConvertFrom-Json)) {
    if ($row.device -notin $manifest.devices -or $coverage.ContainsKey($row.device) -or !$row.revision -or !$row.version -or !$row.eraseDecision) { throw 'Enter one rollback entry per device with exact revision, version and erase decision' }
    if (!$row.application.path -or !$row.application.url -or !$row.application.sha256 -or $row.application.path -notlike "firmware/meshtastic-rollback/$($row.device)/*") { throw 'Rollback entry needs a board-specific application, official URL and reference digest in the device folder' }
    if ($row.eraseDecision -eq 'required' -and (!$row.erase.path -or !$row.erase.url -or !$row.erase.sha256 -or $row.erase.path -notlike "firmware/meshtastic-rollback/$($row.device)/*")) { throw 'Required erase file needs a path, source and reference digest in the device folder' }
    if ($row.eraseDecision -notin @('required','not-required') -or !$row.instructions) { throw 'Record the official restore procedure and whether erase is required' }
    $row.application | Add-Member -NotePropertyName required -NotePropertyValue $true -Force
    $entries += $row.application
    if ($row.eraseDecision -eq 'required') {
      $row.erase | Add-Member -NotePropertyName required -NotePropertyValue $true -Force
      $entries += $row.erase
    }
    $coverage[$row.device] = $true
  }
}
foreach ($device in $manifest.devices) {
  if (!$coverage.ContainsKey($device)) { Write-Warning "$device needs its own checked rollback.json entry."; $failures++ }
}
$report = foreach ($entry in $entries) {
  $hash = ''; $status = ''
  try {
    $path = Get-LocalAssetPath $entry
    if ($entry.url -and $entry.url -notmatch '^https://[^/@]+/') { throw 'Use an official HTTPS download URL' }
    try { $hash = Test-Asset $path $entry } catch {
      if ($VerifyOnly -or !$entry.url -or $entry.path -like 'firmware/meshtastic-rollback/*') { throw }
      $part = "$path.part"
      New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
      try {
        Invoke-WebRequest -UseBasicParsing -Uri $entry.url -OutFile $part
        $hash = Test-Asset $part $entry
        Move-Item -Force -LiteralPath $part -Destination $path
      } finally { if (Test-Path -LiteralPath $part) { Remove-Item -Force -LiteralPath $part } }
    }
    $status = if ($entry.sha256) { 'MATCHED REFERENCE' } else { 'FORMAT CHECKED; LOCAL HASH ONLY' }
  } catch {
    if ($entry.required) { $failures++ }
    $status = "FAILED: $_"
  }
  Write-Host "$status - $($entry.path)"
  [pscustomobject]@{Path=$entry.path;Required=[bool]$entry.required;Status=$status;SHA256=$hash;Reference=$entry.sha256;Source=$entry.url}
}
$report | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath 'download-report.csv'
if ($failures) { Write-Warning "$failures required checks failed. See download-report.csv. No new archive was created."; exit 1 }
if (!$VerifyOnly) {
  $output = Join-Path (Split-Path $PSScriptRoot -Parent) ($manifest.kitName + '-FILES-CHECKED.zip')
  Compress-Archive -Path (Join-Path $PSScriptRoot '*') -DestinationPath $output -Force
  Write-Host "Saved $output"
}
Write-Host 'File checks passed. Hardware and identity restoration still require a rehearsal.'
