import { defineConfig } from 'vite';

// base: './' erzeugt relative Asset-Pfade. Damit funktioniert der Build unter
// https://<user>.github.io/<repository>/ unabhängig von Groß-/Kleinschreibung
// des Repository-Namens – und ebenso lokal oder auf jedem anderen Static-Host.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    open: false,
  },
});
