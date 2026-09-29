"use client";

import { CopyField } from "@/components/dashboard/Modal";

const BUTTON_STYLE =
  "display:inline-block;padding:10px 20px;background:#7a1f3d;color:#ffffff;border-radius:8px;font-family:sans-serif;font-size:14px;font-weight:600;text-decoration:none";

/** Escape a value for use inside a double-quoted HTML attribute. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Copyable "Pay with Octo" HTML and Markdown snippets, with a live preview. Uses only the link URL. */
export function PayWithOctoSnippet({ url }: { url: string }) {
  const html = `<a href="${escapeAttr(url)}" rel="noopener" style="${BUTTON_STYLE}">Pay with Octo</a>`;
  const markdown = `[Pay with Octo](${url.replace(/[()\s]/g, encodeURIComponent)})`;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-foreground">Pay with Octo button</p>
      <div className="flex justify-center rounded-lg bg-surface-sunken p-3">
        {/* Preview only; the click target is disabled so it does not navigate away. */}
        <span
          style={Object.fromEntries(
            BUTTON_STYLE.split(";").map((d) => {
              const [k, v] = d.split(":");
              return [(k ?? "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v ?? ""];
            }),
          )}
        >
          Pay with Octo
        </span>
      </div>
      <CopyField label="HTML" value={html} />
      <CopyField label="Markdown" value={markdown} />
    </div>
  );
}
