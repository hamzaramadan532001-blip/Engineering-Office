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

## Permissions (`PERMISSIONS_API_URL` / `PERMISSIONS_ENFORCEMENT`)

Widgets and the layer catalog are gated by the grants the session carries from the
permissions-api. Copy `.env.example` to `.env.local`; with `PERMISSIONS_API_URL`
unset, local dev runs the no-grants **mock** — gating is off and a standing Arabic
banner says so. A **production** deploy with no `PERMISSIONS_API_URL` throws on the
first session request: absence is treated as a misconfiguration, never as "off".

To ship the viewer **before the permissions-api exists**, set
`PERMISSIONS_ENFORCEMENT=off` (the only value that disables gating; anything but
`on`/`off` is an error). The server then serves no grants, everything is visible to
everyone, auth is presence-only, and every user sees the banner.
⚠️ **Never use `off` once the permissions service is live.** Full table and rollout
notes: `docs/nafath-integration.md` §7.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
