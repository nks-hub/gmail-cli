# gmail-cli installer for Windows.
# Usage: irm https://raw.githubusercontent.com/nks-hub/gmail-cli/main/install.ps1 | iex
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$repo = 'nks-hub/gmail-cli'
$asset = 'gmail-windows-x64.exe'
$base = "https://github.com/$repo/releases/latest/download"

$installDir = if ($env:GMAIL_CLI_INSTALL_DIR) {
    $env:GMAIL_CLI_INSTALL_DIR
} else {
    Join-Path $env:LOCALAPPDATA 'gmail-cli\bin'
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
    $binPath = Join-Path $tmp 'gmail.exe'
    $sumsPath = Join-Path $tmp 'SHA256SUMS'

    Write-Host "Downloading $asset from the latest release..."
    Invoke-WebRequest -Uri "$base/$asset" -OutFile $binPath -UseBasicParsing
    Invoke-WebRequest -Uri "$base/SHA256SUMS" -OutFile $sumsPath -UseBasicParsing

    # Verify the SHA-256 checksum.
    $pattern = "\s$([regex]::Escape($asset))$"
    $line = Get-Content $sumsPath | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if (-not $line) { throw "No checksum published for $asset." }
    $expected = ($line -split '\s+')[0].ToLower()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $binPath).Hash.ToLower()
    if ($expected -ne $actual) { throw "Checksum mismatch; aborting." }
    Write-Host "Checksum verified."

    # Install.
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Copy-Item -Path $binPath -Destination (Join-Path $installDir 'gmail.exe') -Force
    Write-Host "Installed to $installDir\gmail.exe"

    # Add the install directory to the per-user PATH.
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $installDir) {
        $newPath = if ($userPath) { "$userPath;$installDir" } else { $installDir }
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        $env:Path = "$env:Path;$installDir"
        Write-Host "Added $installDir to your user PATH. Restart your terminal to pick it up."
    } else {
        Write-Host "$installDir is already on your PATH."
    }

    Write-Host ""
    Write-Host "Done. Get started with: gmail auth setup"
}
finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
