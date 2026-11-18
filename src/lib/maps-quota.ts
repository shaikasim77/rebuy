// Client-side Google Maps Platform quota defense (Tier 1 & Tier 2 event dispatcher)
export const GMP_QUOTA_EVENT = "gmp-quota-exceeded";

let installed = false;

export function dispatchMapsQuotaExceeded() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GMP_QUOTA_EVENT));
}

export function installMapsQuotaMonitor() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const win = window as unknown as { gm_authFailure?: () => void };
  const prevAuthFailure = win.gm_authFailure;
  win.gm_authFailure = () => {
    if (typeof prevAuthFailure === "function") prevAuthFailure();
    dispatchMapsQuotaExceeded();
  };

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(" ");
    if (msg.includes("OverQuotaMapError") || msg.includes("QuotaExceededError")) {
      dispatchMapsQuotaExceeded();
    }
  };
}
