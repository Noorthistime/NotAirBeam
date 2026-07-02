Write-Host "Opening firewall for OfflineDrop ports 3000 and 4000..." -ForegroundColor Cyan

netsh advfirewall firewall delete rule name="OfflineDrop-3000" 2>$null
netsh advfirewall firewall delete rule name="OfflineDrop-4000" 2>$null

netsh advfirewall firewall add rule name="OfflineDrop-3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="OfflineDrop-4000" dir=in action=allow protocol=TCP localport=4000

Write-Host ""
Write-Host "Done! Firewall rules added for ports 3000 and 4000." -ForegroundColor Green
Write-Host "Your phone should now be able to connect to: http://192.168.0.100:3000" -ForegroundColor Yellow
