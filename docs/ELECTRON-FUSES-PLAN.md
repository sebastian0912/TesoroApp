# Plan de configuración de Electron Fuses

## Qué son

Electron Fuses (`@electron/fuses`) son flags binarios que se "queman" en el
ejecutable de Electron al empaquetar. Una vez quemados, no pueden cambiarse
sin re-empaquetar la app. Sirven para deshabilitar permanentemente features
peligrosas que un atacante con acceso al binario podría usar para escalar.

## Estado actual de TesoroApp

`@electron/fuses` **NO está instalado**. La app empaquetada con
electron-builder usa los defaults de Electron 34, que dejan abiertas
features potencialmente explotables:

- `runAsNode: true` — un atacante puede invocar el ejecutable con
  `ELECTRON_RUN_AS_NODE=1` y obtener un Node.js privilegiado.
- `enableNodeCliInspectArguments: true` — `--inspect` puede activarse desde
  línea de comandos, exponiendo el debugger.
- `enableEmbeddedAsarIntegrityValidation: false` — el `.asar` empaquetado
  no se valida contra una firma; un atacante puede modificarlo.
- `onlyLoadAppFromAsar: false` — el binario aceptará código fuera del asar.

## Configuración recomendada

### 1. Instalar `@electron/fuses` como devDependency

```bash
npm install --save-dev @electron/fuses
```

### 2. Crear script de post-pack que quema las fuses

Crear `scripts/electron-fuses.js`:

```js
const { flipFuses, FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = async function (context) {
  const exe = context.appOutDir + '/' + context.packager.appInfo.productFilename + '.exe';

  await flipFuses(exe, {
    version: FuseVersion.V1,

    // Bloquea el binario para que no pueda usarse como Node.js standalone.
    [FuseV1Options.RunAsNode]: false,

    // Bloquea --inspect / --inspect-brk para que no se pueda debuggear el
    // proceso main desde fuera.
    [FuseV1Options.EnableNodeCliInspectArguments]: false,

    // Valida la integridad del asar contra el header firmado al cargar.
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,

    // Solo carga código desde el asar — bloquea sustitución por archivos sueltos.
    [FuseV1Options.OnlyLoadAppFromAsar]: true,

    // Mantiene cookies en disco encriptadas (default true desde Electron 22+).
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,

    // Bloquea NODE_OPTIONS environment variable que podría inyectar código.
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,

    // Da control granular sobre el cookie encryption.
    // [FuseV1Options.EnableCookieEncryption]: true,  // se activa con app.commandLine en runtime
  });
};
```

### 3. Conectar el script a electron-builder en `package.json`

```json
{
  "build": {
    "afterPack": "scripts/electron-fuses.js",
    ...
  }
}
```

### 4. Validar después de empaquetar

```bash
npm run dist
# El instalador se genera en dist/electron/
# El .exe ya tiene las fuses quemadas
```

Para verificar que las fuses están aplicadas:
```bash
npx @electron/fuses read --app dist/electron/win-unpacked/Gestion\ Tesoreria.exe
```

Salida esperada:
```
RunAsNode is Disabled
EnableNodeCliInspectArguments is Disabled
EnableEmbeddedAsarIntegrityValidation is Enabled
OnlyLoadAppFromAsar is Enabled
EnableNodeOptionsEnvironmentVariable is Disabled
```

## Por qué NO se ejecuta en este sprint

1. **Requiere prueba real con app empaquetada**: `npm run dist` toma 3–5
   minutos y produce un instalador NSIS que necesita Windows real para
   probar (mi entorno es CLI, no puedo abrir el .exe).

2. **Riesgo de bloquear flujos legítimos**:
   - Si alguien usa `electron --inspect` para debuggear producción, dejará
     de funcionar (probablemente esto se quiere — pero hay que confirmar).
   - Si la integridad del asar se activa y el `asarUnpack` mete archivos
     fuera del asar (sqlite3 nativo en este caso), puede fallar la primera
     ejecución.

3. **`asarUnpack` actual**: `node_modules/sqlite3/**/*` se descomprime fuera
   del asar — necesario para que sqlite3 nativo funcione. Habría que
   verificar que la integrity validation NO falle por esos archivos.

## Plan de aplicación segura

1. Crear el script + agregar afterPack en package.json (1 commit).
2. Empaquetar con `npm run dist` en una máquina Windows real.
3. Probar el instalador:
   - App abre y carga la UI.
   - Login funciona.
   - SQLite (cola offline) funciona.
   - Lector de huella funciona (binario C# externo).
   - PDFs se generan.
4. Si todo OK: commit.
5. Si algo falla (probable que sea `EnableEmbeddedAsarIntegrityValidation`
   por sqlite3 nativo): desactivar esa fuse específica y reintentar.

## Beneficio de seguridad

| Fuse | Ataque que bloquea |
|---|---|
| RunAsNode: false | Atacante con acceso al binario invoca `ELECTRON_RUN_AS_NODE=1` para correr código JS arbitrario con Node privileges |
| EnableNodeCliInspectArguments: false | Atacante usa `--inspect-brk` para attachear debugger y inspeccionar tokens en memoria |
| EnableEmbeddedAsarIntegrityValidation: true | Atacante modifica el asar empaquetado (ej: reemplaza preload.js para deshabilitar el whitelist IPC) |
| OnlyLoadAppFromAsar: true | Atacante mete archivos JS sueltos en la carpeta de instalación que se ejecutan en lugar del asar firmado |
| EnableNodeOptionsEnvironmentVariable: false | Atacante setea `NODE_OPTIONS=--require malicious.js` antes de lanzar la app |

Para una app empresarial sin firma de código (ya documentado como riesgo),
**fuses es el endurecimiento más impactante que se puede aplicar**.

## Estimación

1 sesión de 30–60 min en una máquina Windows real con `npm run dist` + prueba
manual del instalador.
