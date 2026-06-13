// Config CI para ejecutar las specs en contenedor (Chromium headless, root → --no-sandbox).
// Inc.2.7 §9: ejecuta REALMENTE las *.spec.ts, no solo el build AOT.
module.exports = function (config) {
  config.set({
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--headless=new'],
      },
    },
    singleRun: true,
    restartOnFileChange: false,
    browserNoActivityTimeout: 120000,
  });
};
