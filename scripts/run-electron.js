// Wrapper que garantiza arrancar Electron como binario (no como Node),
// eliminando ELECTRON_RUN_AS_NODE que algunos terminales (VS Code) inyectan.
const { spawn } = require('child_process');
const electronBinary = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  windowsHide: false,
});

child.on('close', (code, signal) => {
  if (code === null) {
    console.error('electron exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
