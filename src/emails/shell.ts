/** Shared HTML wrapper for all Octo transactional emails. Kept in sync with the backend's
 * `crates/email/src/templates.rs` (the hand-maintained copy actually sent) — this is the source.
 *
 * Images are real HTTPS URLs, not inline data: URIs — Gmail and most clients strip inline
 * data:image/svg+xml (and often data: images generally), so anything shown here has to be
 * fetchable. The logo lives on Cloudinary; the small icon set is served from octohq.org/email/
 * (public/email/ in this repo). */

const BURGUNDY = "#7b1733";
const BURGUNDY_BRIGHT = "#b81f4d";
const INK = "#0a0506";

const LOGO_URL =
  "https://res.cloudinary.com/h9jpvcxe/image/upload/v1786115234/octopus_burgundy_black_bg_wrx0sf.png";
const ICON_BASE = "https://octohq.org/email";

const ICON_URLS: Record<string, string> = {
  key: `${ICON_BASE}/icon-key.png`,
  wave: `${ICON_BASE}/icon-wave.png`,
  check: `${ICON_BASE}/icon-check.png`,
  warn: `${ICON_BASE}/icon-warn.png`,
};

export type EmailIcon = keyof typeof ICON_URLS;

function socialLink(icon: string, href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:0 6px;text-decoration:none;" aria-label="${label}"><img src="${ICON_BASE}/social-${icon}.png" width="32" height="32" alt="${label}" style="display:block;border:0;"/></a>`;
}

const SOCIALS = [
  socialLink("x", "https://x.com/Octo_Hq", "X (Twitter)"),
  socialLink("instagram", "https://instagram.com/OctoHQ", "Instagram"),
  socialLink("linkedin", "https://linkedin.com/company/OctoHQ", "LinkedIn"),
  socialLink("github", "https://github.com/Octo-Protocol-org", "GitHub"),
  socialLink("telegram", "https://t.me/OctoHQ", "Telegram"),
].join("");

export function shell(body: string, icon?: EmailIcon): string {
  const badge = icon
    ? `<div style="text-align:center;margin-bottom:20px;"><img src="${ICON_URLS[icon]}" width="40" height="40" alt="" style="display:inline-block;"/></div>`
    : "";

  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f5f5f5;padding:32px 0;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee;">
<div style="text-align:center;padding:28px 32px 20px;">
<img src="${LOGO_URL}" width="40" height="40" alt="Octo" style="display:inline-block;border-radius:10px;"/>
<div style="margin-top:10px;font-size:16px;font-weight:700;color:${INK};letter-spacing:-0.02em;">Octo</div>
</div>
<div style="height:1px;background:#eee;"></div>
<div style="padding:32px;color:#222;font-size:14px;line-height:1.6;text-align:center;">
${badge}
${body}
</div>
<div style="background:${BURGUNDY};padding:22px 32px;text-align:center;">
${SOCIALS}
<p style="margin:14px 0 0;color:rgba(255,255,255,0.7);font-size:11px;">© ${new Date().getFullYear()} Octo · Stellar-native wallet infrastructure</p>
</div>
</div>
</div>`;
}

export { BURGUNDY, BURGUNDY_BRIGHT };
