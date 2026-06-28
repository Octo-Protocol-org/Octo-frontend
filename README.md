# Octo — Frontend

The Next.js dashboard for **Octo**, a Stellar-native Wallet-as-a-Service. It is a pure client of
the Octo backend API (the Rust `octo-server`), which lives in a separate repo:
**[Octo-Protocol](https://github.com/Octo-Protocol-org/Octo-Protocol)**.

## Configuration

Copy `.env.example` to `.env.local` and point it at your backend:

```bash
cp .env.example .env.local
# NEXT_PUBLIC_OCTO_API_URL=http://localhost:8080   (local) or your deployed API origin
```

> **Note:** `NEXT_PUBLIC_OCTO_API_URL` is **inlined at build time** by Next.js, not read at
> runtime. Changing it requires a rebuild/redeploy. On Vercel, set it in the project's
> Environment Variables and redeploy — editing it without a new build has no effect.

## Deploy

Deploys to **Vercel** (zero-config Next.js). Set `NEXT_PUBLIC_OCTO_API_URL` to the deployed API
origin in the Vercel project settings. Make sure that origin is included in the backend's
`CORS_ALLOWED_ORIGINS` allowlist.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
