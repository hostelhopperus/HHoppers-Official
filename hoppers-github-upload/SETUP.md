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
- Production account creation requires permanent storage unless `ALLOW_TEMPORARY_ACCOUNT_STORAGE=true` is set.
- For real launch, accounts must be stored in Supabase so they survive deploys, restarts, and Vercel cleanup. If Supabase is configured but unavailable in production, Hoppers now blocks account creation and account changes instead of falling back to temporary files.
- Admin login uses a server session cookie.
- Admin approval/rejection is handled by backend API routes.
- Approved hostels are published from backend data.
- Email messages are queued in `data/email-outbox.json` by default.
- If `RESEND_API_KEY` is set, emails are sent through Resend and still logged.
- Paid account signup verifies the Stripe Checkout Session before creating the account.
- Account billing stores Stripe customer, checkout session, payment link, and subscription IDs when Stripe returns them.
- Members can open the Stripe billing portal from their account.
- Members can cancel subscriptions from their account; Hoppers sets the Stripe subscription to cancel at period end. If the subscription ID is missing but the Stripe customer is saved, Hoppers looks up that customer's active subscription before canceling.
- Members can use "forgot username or password" to receive their login email and a one-time reset link.
- Admin can send reset links from the account table without seeing anyone's password.

## Supabase

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Copy the project URL and service role key into `.env`.
4. Keep the service role key server-side only. Never put it in browser JavaScript.

Supabase docs: https://supabase.com/docs/guides/api/data-apis

## Stripe

Stripe can be set up after the website is deployed to a real domain.

1. Keep the four Stripe Buy Buttons / Payment Links for:
   - Worker Basic: $2.99/month
   - Worker Premium: $5.99/month
   - Hostel Basic: $99/month
   - Hostel Premium: $199/month
2. Add `STRIPE_SECRET_KEY` on the server.
3. Configure each Payment Link success redirect to:

```text
https://yourdomain.com/payment-success.html?payment=success&session_id={CHECKOUT_SESSION_ID}
```

4. Configure a webhook to `https://yourdomain.com/api/stripe/webhook`.
5. Listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Put the webhook secret in `STRIPE_WEBHOOK_SECRET`.
7. Enable Stripe Customer Portal so logged-in members can manage billing details.

Without `STRIPE_SECRET_KEY`, production account signup cannot verify payment and should stay blocked. Without the `{CHECKOUT_SESSION_ID}` redirect value, Hoppers cannot store the Stripe customer/subscription IDs needed for cancellation.

Stripe docs: https://docs.stripe.com/payments/checkout

## Email

Set `RESEND_API_KEY` and `EMAIL_FROM` to send real emails. Without those variables, the app writes messages to `data/email-outbox.json`.

Password reset links expire after 1 hour and are stored hashed. In local development, reset links are visible in the outbox so you can test the flow. In production, connect Resend or another email provider before relying on account recovery.

Admin submission notifications are currently configured for:

```text
hostelhopperus@gmail.com
```

## Still recommended before launch

- Replace demo admin code with full admin user accounts.
- Add rate limiting and CAPTCHA or bot protection on public submissions.
- Add legal pages: Terms, Privacy, Refund/Cancellation Policy.
- Add production error logging and backups.
