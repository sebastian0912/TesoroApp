; ============================================================
; Instala el certificado de code signing de Apoyo Laboral
; automaticamente durante la instalacion de la app.
; Se ejecuta silenciosamente - el usuario no ve nada extra.
; ============================================================

!macro customInstall
  ; El .cer queda en $INSTDIR\resources\certs\code-signing.cer
  ; certutil -addstore agrega el cert al store de la maquina
  DetailPrint "Instalando certificado de confianza..."
  nsExec::ExecToLog 'certutil -addstore "TrustedPublisher" "$INSTDIR\resources\certs\code-signing.cer"'
  nsExec::ExecToLog 'certutil -addstore "Root" "$INSTDIR\resources\certs\code-signing.cer"'
!macroend
