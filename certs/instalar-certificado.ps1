# ============================================================
# INSTALAR CERTIFICADO DE APOYO LABORAL EN ESTA MAQUINA
# Ejecutar UNA SOLA VEZ como Administrador en cada PC:
#   Click derecho > "Ejecutar con PowerShell como Administrador"
#
# O desde PowerShell Admin:
#   powershell -ExecutionPolicy Bypass -File instalar-certificado.ps1
# ============================================================

$cerFile = Join-Path $PSScriptRoot "code-signing.cer"

if (-not (Test-Path $cerFile)) {
    Write-Host "ERROR: No se encontro code-signing.cer en la misma carpeta que este script." -ForegroundColor Red
    Write-Host "Asegurese de copiar code-signing.cer junto con este script."
    pause
    exit 1
}

try {
    # Instalar en "Trusted Publishers" (editores de confianza) para que Windows confie en los .exe firmados
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "LocalMachine")
    $store.Open("ReadWrite")
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cerFile)
    $store.Add($cert)
    $store.Close()

    # Tambien instalar en "Trusted Root" para cadena de confianza completa
    $store2 = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
    $store2.Open("ReadWrite")
    $store2.Add($cert)
    $store2.Close()

    Write-Host ""
    Write-Host "LISTO! Certificado de Apoyo Laboral instalado correctamente." -ForegroundColor Green
    Write-Host "La aplicacion Gestion Tesoreria ahora se actualizara sin errores."
    Write-Host ""
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Asegurese de ejecutar este script como ADMINISTRADOR."
}

pause
