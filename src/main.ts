import { App } from './app.ts';

/**
 * Einstiegspunkt: prüft WebGL, startet die Anwendung und zeigt
 * verständliche Lade- und Fehlerzustände.
 */
const boot = document.getElementById('boot-screen');
const status = document.getElementById('boot-status');
const progress = document.getElementById('boot-progress');

function setProgress(p: number, text: string): void {
  if (progress) progress.style.width = `${Math.round(p * 100)}%`;
  if (status) status.textContent = text;
}

function fail(message: string, detail?: unknown): void {
  console.error('[Kingshot]', message, detail);
  if (boot) {
    boot.classList.add('is-error');
    boot.classList.remove('is-done');
  }
  if (status) status.textContent = message;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  setProgress(0.2, 'Prüfe Grafikunterstützung …');
  if (!hasWebGL()) {
    fail('WebGL wird von diesem Browser nicht unterstützt oder ist deaktiviert. Bitte aktiviere die Hardwarebeschleunigung oder nutze einen aktuellen Browser.');
    return;
  }
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');
  if (!canvas || !uiRoot) {
    fail('Interner Fehler: Spielfläche nicht gefunden.');
    return;
  }
  setProgress(0.5, 'Erschaffe die Welt von Aetheria …');
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  let app: App;
  try {
    app = new App(canvas, uiRoot);
  } catch (err) {
    fail('Das Spiel konnte nicht gestartet werden (Grafikinitialisierung fehlgeschlagen).', err);
    return;
  }
  setProgress(1, 'Bereit');
  app.start();
  (window as unknown as { kingshot?: App }).kingshot = app;
  setTimeout(() => boot?.classList.add('is-done'), 250);
  setTimeout(() => boot?.remove(), 1100);
}

window.addEventListener('error', (e) => {
  if (boot && document.body.contains(boot) && !boot.classList.contains('is-done')) fail('Beim Laden ist ein Fehler aufgetreten.', e.error);
});

void main();
