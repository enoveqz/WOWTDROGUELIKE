export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', htmlContent = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (htmlContent) e.innerHTML = htmlContent;
  return e;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Delegiert Klicks auf [data-action]-Elemente innerhalb eines Containers. */
export function onAction(root: HTMLElement, handler: (action: string, target: HTMLElement, ev: MouseEvent) => void): void {
  root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('disabled') || t.classList.contains('is-disabled')) return;
    handler(t.dataset.action!, t, ev);
  });
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('de-DE');
export const pctFmt = (n: number, d = 0): string => `${(n * 100).toFixed(d).replace('.', ',')} %`;
