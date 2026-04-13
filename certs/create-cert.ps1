# Script para crear certificado de code signing autofirmado
# Ejecutar con: powershell -ExecutionPolicy Bypass -File create-cert.ps1

$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Apoyo Laboral TS SAS, O=Apoyo Laboral TS SAS, L=Bogota, C=CO" -FriendlyName "Apoyo Laboral Code Signing" -CertStoreLocation "Cert:\CurrentUser\My" -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(5)

Write-Host "Thumbprint: $($cert.Thumbprint)"

$password = ConvertTo-SecureString -String "ApoyoLaboral2026!" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "$PSScriptRoot\code-signing.pfx" -Password $password
Export-Certificate -Cert $cert -FilePath "$PSScriptRoot\code-signing.cer" -Type CERT

Write-Host ""
Write-Host "LISTO. Archivos creados:"
Write-Host "  code-signing.pfx  -> para firmar el .exe (NO compartir, NO subir a git)"
Write-Host "  code-signing.cer  -> para instalar en las maquinas de los usuarios"
