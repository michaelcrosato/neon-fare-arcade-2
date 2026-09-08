/** Clipboard API first, with a user-gesture fallback for non-secure previews. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (clipboardError) {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const field = document.createElement("textarea");
    field.value = text;
    field.readOnly = true;
    field.setAttribute("aria-hidden", "true");
    Object.assign(field.style, {
      position: "fixed",
      inset: "0 auto auto -9999px",
      opacity: "0",
    });
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    active?.focus();
    if (!copied) throw clipboardError;
  }
}
