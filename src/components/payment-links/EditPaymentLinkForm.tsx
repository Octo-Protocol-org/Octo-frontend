"use client";

import { useState, type FormEvent } from "react";
import { ActionButton } from "@/components/dashboard/WalletUI";
import { asAuthToken, asWalletId } from "@/lib/brands";
import { formatStroops } from "@/lib/amount";
import { isTrustedImageUrl } from "@/lib/isTrustedImageUrl";
import type { PaymentLink } from "@/lib/payment-links";
import { updatePaymentLink, validateRedirectUrl } from "@/lib/paymentLinkEditApi";
import { ALLOWED_IMAGE_TYPES, uploadImage, validateImage } from "@/lib/uploads";

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-foreground outline-none focus:border-burgundy/50";

/** Edit form for an existing link; the slug/URL and amount are not editable. */
export function EditPaymentLinkForm({
  link,
  token,
  walletId,
  onSaved,
  onCancel,
}: {
  link: PaymentLink;
  token: string;
  walletId: string;
  onSaved: (link: PaymentLink) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(link.name);
  const [description, setDescription] = useState(link.description ?? "");
  const [redirectUrl, setRedirectUrl] = useState(link.redirect_url ?? "");
  // imageUrl is the stored image; a picked file replaces it only when the form is saved.
  const [imageUrl, setImageUrl] = useState<string | null>(link.image_url);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only checks the picked file. It uploads when the form is saved.
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (file) {
      try {
        await validateImage(file);
      } catch (err) {
        e.target.value = "";
        setImageFile(null);
        setError(err instanceof Error ? err.message : "Image upload failed.");
        return;
      }
    }
    setImageFile(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const redirectError = validateRedirectUrl(redirectUrl.trim());
    if (redirectError) {
      setError(redirectError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextImageUrl = imageFile ? await uploadImage(token, imageFile) : imageUrl;
      onSaved(
        await updatePaymentLink(asAuthToken(token), asWalletId(walletId), link.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          imageUrl: nextImageUrl,
          redirectUrl: redirectUrl.trim() || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">Image (optional)</label>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-sunken">
            {isTrustedImageUrl(imageUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl!} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg text-muted">🖼</span>
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={handleImageChange}
              className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:border-burgundy/50"
            />
            {imageUrl && (
              <button
                type="button"
                onClick={() => {
                  setImageUrl(null);
                  setImageFile(null);
                }}
                className="mt-1 text-[11px] text-muted hover:text-foreground"
              >
                Remove image
              </button>
            )}
          </div>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Amount (USD)</label>
        <input
          value={link.amount_usdc_stroops !== null ? formatStroops(link.amount_usdc_stroops) : "Flexible"}
          disabled
          className={`${inputCls} opacity-60`}
        />
        <p className="mt-1 text-[11px] text-muted">
          The amount and public URL cannot be changed. Create a new link for a different amount.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Redirect URL (optional)</label>
        <input
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
          placeholder="https://your-site.com/thank-you"
          className={inputCls}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-foreground transition-colors hover:border-burgundy/50"
        >
          Cancel
        </button>
        <ActionButton
          type="submit"
          label={saving ? "Saving…" : "Save changes"}
          disabled={!name.trim() || saving}
          loading={saving}
        />
      </div>
    </form>
  );
}
