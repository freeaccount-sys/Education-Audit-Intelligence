param(
  [string]$SourcePath = "C:\antigravity\audit_files",
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\audit-index.json")
)

function Normalize-Token {
  param([string]$Value)

  return ($Value -replace '\+', ' ' -replace '_', ' ' -replace '\s+', ' ').Trim()
}

function Strip-Noise {
  param([string]$Value)

  $text = Normalize-Token $Value
  $text = $text -replace '^\[.*?\]\s*', ''
  $text = $text -replace '^(붙임\d*|붙임|첨부|공개본|홈페이지\s*탑재|홈페이지탑재)\s*', ''
  $text = $text -replace '^\d{6}\s*', ''
  return $text.Trim()
}

function Get-AuditType {
  param([string]$Stem)

  if ($Stem -match '특정\s*감사|특정감사') { return '특정감사' }
  if ($Stem -match '재무\s*감사|재무감사') { return '재무감사' }
  if ($Stem -match '회계부분\s*감사|회계부분감사|회계\s*감사') { return '회계부분감사' }
  if ($Stem -match '종합\s*감사|종합감사') { return '종합감사' }
  return '미분류'
}

function Get-InstitutionKind {
  param([string]$Stem)

  if ($Stem -match '학교법인') {
    return '학교법인'
  }

  return '사립대학'
}

function Get-Institution {
  param([string]$Stem)

  $pattern = '학교법인\s+(.+?)\s+및\s+(.+?)\s+(종합\s*감사|종합감사|회계부분\s*감사|회계부분감사|재무\s*감사|재무감사|특정\s*감사|특정감사)'
  if ($Stem -match $pattern) {
    return (Normalize-Token $Matches[2])
  }

  $pattern = '(.+?)\s+(종합\s*감사|종합감사|회계부분\s*감사|회계부분감사|재무\s*감사|재무감사|특정\s*감사|특정감사)'
  if ($Stem -match $pattern) {
    return (Normalize-Token ($Matches[1] -replace '^학교법인\s+', ''))
  }

  return (Normalize-Token ($Stem -replace '^학교법인\s+', ''))
}

$files = Get-ChildItem -LiteralPath $SourcePath -File -Filter *.pdf

$items = foreach ($file in $files) {
  $stem = Strip-Noise ([System.IO.Path]::GetFileNameWithoutExtension($file.Name))
  [pscustomobject]@{
    id              = $file.BaseName
    fileName        = $file.Name
    filePath        = $file.FullName
    institutionKind = Get-InstitutionKind $stem
    institution     = Get-Institution $stem
    type            = Get-AuditType $stem
    status          = 'OCR 대기'
    severity        = 'low'
    summary         = '파일명 기반 인덱스'
    findings        = @()
    fileSize        = $file.Length
    lastWriteTime   = $file.LastWriteTime.ToString('s')
  }
}

$json = $items | ConvertTo-Json -Depth 6
Set-Content -LiteralPath $OutputPath -Value $json -Encoding utf8

Write-Host "Wrote $($items.Count) records to $OutputPath"

