// Helpers de seguridad para el main process de Electron.
// Centralizan validación de URLs externas y validación de origen IPC, para
// que app.js y electron-db.js compartan la misma política sin duplicar.

const log = require('electron-log');
const { shell } = require('electron');

// ─── URLs externas (shell.openExternal) ──────────────────────────────────
// Solo se permiten URLs https:. Bloquea http:, file:, javascript:, data:
// y cualquier protocolo no estándar — son vectores comunes de RCE/leakage.
function isSafeExternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return false;
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Apertura segura: log + no-throw si la URL es inválida.
function openExternalIfSafe(rawUrl) {
  if (!isSafeExternalUrl(rawUrl)) {
    try { log.warn('[security] shell.openExternal blocked non-https URL:', rawUrl); } catch { /* noop */ }
    return Promise.resolve(false);
  }
  return shell.openExternal(rawUrl).then(() => true).catch(() => false);
}

// ─── Validación de sender frame para IPC ─────────────────────────────────
// Solo permite invocaciones desde:
//   - file://       (producción Electron empaquetada)
//   - http://localhost o http://127.0.0.1 (ng serve en desarrollo)
// Cualquier otro origen (página remota inyectada, iframe externo) se rechaza.
function isAllowedIpcSender(event) {
  try {
    const senderUrl = event && event.senderFrame ? event.senderFrame.url : null;
    if (!senderUrl) return false;
    const url = new URL(senderUrl);
    if (url.protocol === 'file:') return true;
    const allowedOrigins = new Set([
      'http://localhost',
      'http://127.0.0.1',
    ]);
    const origin = `${url.protocol}//${url.hostname}`;
    return allowedOrigins.has(origin);
  } catch {
    return false;
  }
}

function assertAllowedIpcSender(event) {
  if (!isAllowedIpcSender(event)) {
    try {
      const senderUrl = event && event.senderFrame ? event.senderFrame.url : '<unknown>';
      log.warn('[security] IPC handler rejected unauthorized sender:', senderUrl);
    } catch { /* noop */ }
    throw new Error('Unauthorized IPC sender');
  }
}

module.exports = {
  isSafeExternalUrl,
  openExternalIfSafe,
  isAllowedIpcSender,
  assertAllowedIpcSender,
};
