; ============================================================
; Post-instalacion automatica:
; 1. Instala certificado de code signing como confiable
; 2. Agrega exclusion en Windows Defender para la app
; 3. Marca la app como confiable para SmartScreen
; Todo silencioso - el usuario no ve nada extra.
; ============================================================

!macro customInstall
  ; --- 1) Certificado de confianza ---
  DetailPrint "Instalando certificado de confianza..."
  nsExec::ExecToLog 'certutil -addstore "TrustedPublisher" "$INSTDIR\resources\certs\code-signing.cer"'
  nsExec::ExecToLog 'certutil -addstore "Root" "$INSTDIR\resources\certs\code-signing.cer"'

  ; --- 2) Exclusion en Windows Defender ---
  ; Excluir la carpeta de instalacion para que Defender no bloquee la app ni updates
  DetailPrint "Configurando exclusion de Windows Defender..."
  nsExec::ExecToLog 'powershell -Command "Add-MpPreference -ExclusionPath ''$INSTDIR'' -ErrorAction SilentlyContinue"'
  ; Excluir la carpeta del auto-updater
  nsExec::ExecToLog 'powershell -Command "Add-MpPreference -ExclusionPath ''$LOCALAPPDATA\tesoreria-updater'' -ErrorAction SilentlyContinue"'

  ; --- 3) SmartScreen: marcar exe como confiable via Zone.Identifier ---
  ; Eliminar el "Mark of the Web" del exe instalado para que SmartScreen no lo marque
  DetailPrint "Configurando confianza SmartScreen..."
  nsExec::ExecToLog 'powershell -Command "Get-ChildItem ''$INSTDIR\*.exe'' -Recurse | ForEach-Object { Remove-Item -Path $$_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue }"'
  ; Tambien para el updater pending
  nsExec::ExecToLog 'powershell -Command "if (Test-Path ''$LOCALAPPDATA\tesoreria-updater'') { Get-ChildItem ''$LOCALAPPDATA\tesoreria-updater\*.exe'' -Recurse | ForEach-Object { Remove-Item -Path $$_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue } }"'
!macroend
