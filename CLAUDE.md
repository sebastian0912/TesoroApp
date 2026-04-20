# TesoroApp

App de escritorio (Windows) para control de tesorería y préstamos. Uso interno Apoyo Laboral / Tu Alianza.

## Stack
- Angular (frontend) + Electron (runtime)
- SQLite local (`electron-db.js`) además del backend remoto
- `preload.js` con IPC seguro
- Integración C#: `csharp/UareUSampleCSharp_CaptureOnly.exe` para lector biométrico **U.are.U**
- Empaquetado: electron-builder (appId `com.apoyolaboral.gestion-tesoreria`)

## Comandos
```bash
npm install
npm start              # ng serve + electron
ng build               # build Angular
npm run electron:build # empaquetar Windows installer
npm test
```
(Revisar `package.json` para scripts exactos antes de asumir.)

## Arquitectura Electron
- **Main process:** `app.js` — crea BrowserWindow, registra IPC handlers, abre SQLite.
- **Preload:** `preload.js` — expone API mínima al renderer via `contextBridge`. **No** exponer `ipcRenderer` crudo ni `require`.
- **Renderer:** Angular en `src/`.
- **DB local:** `electron-db.js` — SQLite para caché offline y datos sensibles de sesión.
- **Huella:** el `.exe` C# se invoca desde el main process. Validar stdin/stdout, nunca pasar inputs sin sanear.

## Reglas específicas
- **Nunca** tocar `preload.js` / `app.js` / `electron-db.js` sin revisión de security agent.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — si algo de esto se desactiva, es regresión de seguridad.
- El `.exe` de huella **no se modifica**; solo se invoca. Validar paths absolutos al ejecutarlo.
- Firma de código del instalador: credenciales nunca van a git.
- Al actualizar Angular, verificar que `ng build` siga produciendo salida compatible con Electron (output path, base href).

## Conexión al backend
Consume `back-tu-apo-django`. Revisar URL base en la config del renderer. Login biométrico envía token a JWT endpoint.

## Sensibilidad
Maneja **tesorería** (dinero, préstamos a empleados). Errores aquí tienen impacto directo. Cualquier cambio de lógica financiera debe pasar por:
1. `architect` (impacto),
2. `tester-electron` (cobertura),
3. `security` (IPC + SQLite).
