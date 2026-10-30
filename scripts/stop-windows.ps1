# Stops and removes the Prelegal container. Accounts and documents stay in the prelegal-data
# volume for the next start; to delete them too, run: docker volume rm prelegal-data

if (docker ps -aq --filter "name=^prelegal$") { docker rm -f prelegal | Out-Null }
Write-Host "Prelegal stopped"
