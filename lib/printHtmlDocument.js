/**
 * طباعة مستند HTML كامل عبر iframe مخفي ثم contentWindow.print()
 * (يتجنب تعارض React مع window.open المباشر).
 *
 * @param {string} html
 * @param {{ iframeTitle?: string }} [opts]
 */
export function printHtmlDocument(html, opts = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", opts.iframeTitle || "طباعة");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      const p = iframe.parentNode;
      if (p) p.removeChild(iframe);
    }
  };

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
    win.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 90_000);
  };

  const schedulePrint = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(runPrint, 50);
      });
    });
  };

  if (doc.readyState === "complete") {
    schedulePrint();
  } else {
    win.addEventListener("load", schedulePrint, { once: true });
  }
}
