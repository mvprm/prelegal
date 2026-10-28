# Stops and removes the Prelegal container, discarding its temporary database.

if (docker ps -aq --filter "name=^prelegal$") { docker rm -f prelegal | Out-Null }
Write-Host "Prelegal stopped"
