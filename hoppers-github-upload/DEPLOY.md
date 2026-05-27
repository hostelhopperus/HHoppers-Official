# Deploy Hoppers

This app is a Node website with a small backend. People can access it once it is deployed to a public hosting provider and connected to a domain.

## What to deploy

Deploy the whole folder. The server entry point is:

```bash
node server.js
```

The app reads the public website files, the admin dashboard, and backend API routes from the same Node server.

## Required production environment variables

Set these in your hosting provider:

```text
ADMIN_CODE=use-a-long-private-admin-code
PUBLIC_BASE_URL=https://yourdomain.com
ADMIN_NOTIFICATION_EMAIL=hostelhopperus@gmail.com
```

For production storage, also set:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run `supabase-schema.sql` in Supabase before switching those on.

## Optional later services

Email delivery:

```text
RESEND_API_KEY=...
EMAIL_FROM=Hoppers <hello@yourdomain.com>
```

Stripe after the website/domain is live:

```text
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_WORKER_BASIC_PRICE_ID=...
STRIPE_WORKER_PREMIUM_PRICE_ID=...
STRIPE_HOSTEL_PARTNER_PRICE_ID=...
```

## Easy hosting options

Use any host that supports a Node web service:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform
- A VPS running Docker

This repo includes:

- `package.json` with `npm start`
- `Dockerfile`
- `render.yaml`

## After deployment

1. Open the public URL.
2. Submit a worker or hostel test profile.
3. Open `/admin.html`.
4. Log in with `ADMIN_CODE`.
5. Approve a test hostel.
6. Confirm it appears on the public Profiles section.
7. Update DNS so your domain points to the deployed app.

## Important

Do not deploy with the demo admin code. Do not commit `.env`.
