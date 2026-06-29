export function toast(msg: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("niqat-toast", { detail: msg }));
}
