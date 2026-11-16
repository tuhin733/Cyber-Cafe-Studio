param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$wiaIntentMaximizeQuality = 0x20000
$wiaPngFormat = "{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}"

try {
  $dialog = New-Object -ComObject WIA.CommonDialog
  $image = $dialog.ShowAcquireImage(
    1,
    $wiaIntentMaximizeQuality,
    0,
    $wiaPngFormat,
    $true,
    $true,
    $false
  )

  if ($null -eq $image) {
    exit 2
  }

  $image.SaveFile($OutputPath)
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
