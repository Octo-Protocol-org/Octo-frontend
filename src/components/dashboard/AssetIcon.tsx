import { USDC_TESTNET } from "@/lib/wallets";

function XlmIcon({ className }: { className: string }) {
  return (
    <span
      className={`flex ${className} items-center justify-center rounded-full bg-white p-1.5`}
    >
      <svg viewBox="0 0 24 24" fill="#000000" className="h-full w-full">
        <path d="M5.826 12.849A6.7 6.7 0 0 1 6.6 8.772a6.4 6.4 0 0 1 2.255-2.373a6.04 6.04 0 0 1 3.088-.892a6.03 6.03 0 0 1 3.105.824l1.426-.757a7.35 7.35 0 0 0-7.933-.648a7.75 7.75 0 0 0-3.035 2.927a8.2 8.2 0 0 0-1.1 4.754c.022.283-.039.566-.173.816s-.335.45-.579.58L3 14.351v1.622l18-9.565V4.786zM21 8.031L6.79 15.576L3 17.59v1.621l15.178-8.065q.053.426.053.855a6.7 6.7 0 0 1-.827 3.232a6.4 6.4 0 0 1-2.258 2.375c-.931.571-2 .879-3.092.89a6.03 6.03 0 0 1-3.107-.83l-.076.043l-1.345.714a7.35 7.35 0 0 0 7.932.649a7.75 7.75 0 0 0 3.035-2.925a8.2 8.2 0 0 0 1.1-4.759c-.02-.283.04-.566.174-.816a1.4 1.4 0 0 1 .578-.58L21 9.648z" />
      </svg>
    </span>
  );
}

function UsdcIcon({ className }: { className: string }) {
  return (
    <span
      className={`flex ${className} items-center justify-center rounded-full bg-white p-1.5`}
    >
      <svg viewBox="0 0 24 24" fill="#000000" className="h-full w-full">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 21c4.99 0 9-4.01 9-9s-4.01-9-9-9s-9 4.01-9 9s4.01 9 9 9m2.475-7.578c0-1.31-.787-1.76-2.362-1.946c-1.125-.152-1.35-.45-1.35-.978c0-.523.377-.86 1.125-.86c.675 0 1.052.224 1.237.787c.04.112.152.185.265.185h.596a.256.256 0 0 0 .264-.259v-.039c-.152-.827-.827-1.614-1.687-1.687v-.827c0-.152-.113-.265-.298-.298h-.495c-.152 0-.293.112-.332.298v.827c-1.125.151-1.873 1.012-1.873 1.951c0 1.238.748 1.722 2.323 1.913c1.052.185 1.39.41 1.39 1.012c0 .597-.53 1.013-1.238 1.013c-.98 0-1.316-.416-1.429-.979c-.034-.146-.146-.225-.259-.225h-.641a.256.256 0 0 0-.259.264v.04c.146.934.748 1.575 1.986 1.76v.833c0 .152.112.253.298.293h.54c.146 0 .248-.102.287-.293v-.833c1.125-.185 1.912-.939 1.912-1.952m-6.262 2.803a5.6 5.6 0 0 0 1.875 1.135c.112.079.225.225.225.338v.528c0 .073 0 .113-.04.146c-.033.152-.185.225-.337.152a6.751 6.751 0 0 1 0-12.864c.04-.034.112-.034.152-.034c.152.034.225.147.225.298v.524c0 .19-.073.303-.225.376a5.55 5.55 0 0 0-3.336 3.336a5.59 5.59 0 0 0 1.46 6.065m5.514-10.413c.034-.152.186-.225.338-.152a6.8 6.8 0 0 1 4.387 4.427c1.125 3.56-.827 7.352-4.387 8.477c-.04.033-.113.033-.152.033c-.152-.033-.225-.146-.225-.298v-.523c0-.191.073-.303.225-.377a5.55 5.55 0 0 0 3.335-3.335a5.585 5.585 0 0 0-3.335-7.2c-.113-.079-.225-.225-.225-.377v-.523c0-.079 0-.113.04-.152"
        />
      </svg>
    </span>
  );
}

/** Real brand icon for known Stellar assets (native XLM, testnet USDC); falls back to a
 * code-initial badge for anything else, since we can't ship a logo for every issued asset. */
export function AssetIcon({
  isNative,
  code,
  issuer,
  className = "h-8 w-8",
}: {
  isNative: boolean;
  code?: string | null;
  issuer?: string | null;
  className?: string;
}) {
  if (isNative) return <XlmIcon className={className} />;
  if (code === USDC_TESTNET.code && issuer === USDC_TESTNET.issuer) {
    return <UsdcIcon className={className} />;
  }
  return (
    <span
      className={`flex ${className} items-center justify-center rounded-full bg-burgundy/30 text-[10px] font-semibold text-burgundy-bright`}
    >
      {(code ?? "?").slice(0, 4)}
    </span>
  );
}
