# Builds the Prelegal image and starts it at http://localhost:8000.
# Docker failures are caught through $LASTEXITCODE, not $ErrorActionPreference = "Stop":
# Windows PowerShell would treat docker's progress output on stderr as an error.
Push-Location (Join-Path $PSScriptRoot "..")
try {
    docker build -t prelegal .
    if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

    # Replace any previous container. Accounts and documents are kept in the prelegal-data
    # volume, which Docker creates on first use.
    if (docker ps -aq --filter "name=^prelegal$") { docker rm -f prelegal | Out-Null }

    # .env holds API keys; it is optional until a feature needs them.
    $envFileArgs = @()
    if (Test-Path ".env") { $envFileArgs = @("--env-file", ".env") }

    docker run -d --name prelegal -p 8000:8000 -v prelegal-data:/data @envFileArgs prelegal | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "docker run failed" }
    Write-Host "Prelegal is running at http://localhost:8000"
}
finally {
    # Leave the caller's shell where it was.
    Pop-Location
}
