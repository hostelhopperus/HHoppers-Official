# Hoppers Backend Setup

This workspace now runs as a small Node backend plus the static website.

For public deployment, see `DEPLOY.md`.

## Run locally

```bash
node server.js
```

Open:

```text
http://127.0.0.1:4173
```

Admin:

```text
http://127.0.0.1:4173/admin.html
```

Default local admin code:

```text
finntazer_69
```

Set `ADMIN_CODE` before running the server to change it.

## What is real now

- Submissions are saved on the backend in `data/submissions.json` by default.
- If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, submissions are saved to Supabase instead.
- Admin login uses a server session cookie.
- Admin approval/rejection is handled by backend API routes.
- Approved hostels are published from backend data.
- Email messages are queued in `data/email-outbox.json` by default.
- If `RESEND_API_KEY` is set, emails are sent through Resend and still logged.
- Payment records track selected plan, signup fee, monthly fee, and billing setup state.
- By default, no payment details are collected. Billing setup is deferred until the website/domain and Stripe account are ready.
- If `STRIPE_SECRET_KEY` is set later, public submissions can create a Stripe Checkout session for the signup fee.
- If Stripe monthly price IDs are set later, approval can attempt to create the monthly subscription.

## Supabase

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Copy the project URL and service role key into `.env`.
4. Keep the service role key server-side only. Never put it in browser JavaScript.

Supabase docs: https://supabase.com/docs/guides/api/data-apis

## Stripe

Stripe can be set up after the website is deployed to a real domain.

1. Create Stripe products/prices for:
   - Worker Basic: $5/month
   - Worker Premium: $10/month
   - Hostel Partner: $75/month
2. Put the monthly price IDs in `.env`.
3. Add `STRIPE_SECRET_KEY`.
4. Configure a webhook to `https://yourdomain.com/api/stripe/webhook`.
5. Put the webhook secret in `STRIPE_WEBHOOK_SECRET`.

Pre-Stripe mode does not ask users for card details. Once Stripe is enabled, the app can create a Stripe Checkout session for the signup fee. When Stripe sends `checkout.session.completed`, the backend marks the signup fee as paid. On admin approval, the backend can attempt to start the monthly subscription.

Stripe docs: https://docs.stripe.com/payments/checkout

## Email

Set `RESEND_API_KEY` and `EMAIL_FROM` to send real emails. Without those variables, the app writes messages to `data/email-outbox.json`.

Admin submission notifications are currently configured for:

```text
hostelhopperus@gmail.com
```

## Still recommended before launch

- Replace demo admin code with full admin user accounts.
- Add rate limiting and CAPTCHA or bot protection on public submissions.
- Add legal pages: Terms, Privacy, Refund/Cancellation Policy.
- Add production error logging and backups.
