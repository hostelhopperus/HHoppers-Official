const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

loadEnv();

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const EMAIL_OUTBOX_FILE = path.join(DATA_DIR, "email-outbox.json");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const ADMIN_CODE = process.env.ADMIN_CODE || "finntazer_69";
const SESSION_COOKIE = "hh_admin";
const ACCOUNT_COOKIE = "hh_account";
const sessions = new Set();
const accountSessions = new Map();
const rateBuckets = new Map();

const PLAN_DETAILS = {
  "worker-basic": {
    label: "Worker Basic",
    signupFee: 10,
    monthlyFee: 5,
    stripePriceId: process.env.STRIPE_WORKER_BASIC_PRICE_ID,
  },
  "worker-premium": {
    label: "Worker Premium",
    signupFee: 10,
    monthlyFee: 10,
    stripePriceId: process.env.STRIPE_WORKER_PREMIUM_PRICE_ID,
  },
  "hostel-partner": {
    label: "Hostel Partner",
    signupFee: 100,
    monthlyFee: 75,
    stripePriceId: process.env.STRIPE_HOSTEL_PARTNER_PRICE_ID,
  },
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const PUBLIC_FILE_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".svg"]);
const PUBLIC_DIRECTORIES = new Set(["", "assets"]);

function loadEnv() {
  try {
    const text = require("node:fs").readFileSync(path.join(__dirname, ".env"), "utf8");
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    });
  } catch {
    // .env is optional.
  }
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host}`;
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function isAdmin(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  return Boolean(token && sessions.has(token));
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function rateLimit(req, key, limit, windowMs) {
  const bucketKey = `${clientIp(req)}:${key}`;
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(bucketKey, bucket);
  return bucket.count <= limit;
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await readJson(SUBMISSIONS_FILE, []);
  await readJson(EMAIL_OUTBOX_FILE, []);
  await readJson(ACCOUNTS_FILE, []);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    await fs.writeFile(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readBody(req) {
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString("utf8"));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultAccountPlan(type) {
  return type === "hostel" ? "hostel-partner" : "worker-basic";
}

function planDetails(plan, type) {
  return PLAN_DETAILS[plan] || PLAN_DETAILS[type === "hostel" ? "hostel-partner" : "worker-basic"];
}

function buildPaymentRecord(type, plan) {
  const details = planDetails(plan, type);
  return {
    provider: process.env.STRIPE_SECRET_KEY ? "stripe" : "pre-stripe",
    plan,
    planLabel: details.label,
    signupFee: details.signupFee,
    monthlyFee: details.monthlyFee,
    signupFeeStatus: process.env.STRIPE_SECRET_KEY ? "checkout_pending" : "billing_setup_pending",
    monthlyStatus: "billing_setup_after_approval",
    stripeCustomerId: null,
    stripeCheckoutSessionId: null,
    stripeSubscriptionId: null,
  };
}

function buildAccountBilling(type, plan) {
  const details = planDetails(plan, type);
  return {
    provider: process.env.STRIPE_SECRET_KEY ? "stripe" : "pre-stripe",
    plan,
    planLabel: details.label,
    signupFee: details.signupFee,
    monthlyFee: details.monthlyFee,
    status: "billing_setup_after_approval",
  };
}

function hashPassword(password) {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(String(password), passwordSalt, 64).toString("hex");
  return { passwordHash, passwordSalt };
}

function verifyPassword(password, account) {
  try {
    const expected = Buffer.from(account.passwordHash, "hex");
    const actual = crypto.scryptSync(String(password), account.passwordSalt, 64);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function sanitizeAccountProfile(input, type, existing = {}) {
  const profile = input && typeof input === "object" ? input : {};
  const plan = profile.plan || existing.plan || defaultAccountPlan(type);
  const photos = Array.isArray(profile.photos)
    ? profile.photos
    : Array.isArray(existing.photos)
      ? existing.photos
      : [];
  return {
    name: String(profile.name || existing.name || "").trim(),
    location: String(profile.location || existing.location || "").trim(),
    website: String(profile.website || existing.website || "").trim(),
    nationality: String(profile.nationality || existing.nationality || "").trim(),
    tags: normalizeList(profile.tags || profile.skills || profile.roles || existing.tags),
    startDate: String(profile.startDate || existing.startDate || "").trim(),
    endDate: String(profile.endDate || existing.endDate || "").trim(),
    bio: String(profile.bio || profile.description || existing.bio || "").trim(),
    photo: String(profile.photo || existing.photo || "").startsWith("data:image/") ? String(profile.photo || existing.photo || "") : "",
    photos: type === "hostel" ? photos.filter((photo) => String(photo || "").startsWith("data:image/")).slice(0, 10) : [],
    plan,
  };
}

function toDbAccount(account) {
  return {
    id: account.id,
    type: account.type,
    email: account.email,
    password_hash: account.passwordHash,
    password_salt: account.passwordSalt,
    status: account.status,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
    profile: account.profile,
    billing: account.billing,
  };
}

function fromDbAccount(row) {
  return {
    id: row.id,
    type: row.type,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    status: row.status || "profile_draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile: row.profile || {},
    billing: row.billing || buildAccountBilling(row.type, row.profile?.plan || defaultAccountPlan(row.type)),
  };
}

function publicAccount(account) {
  return {
    id: account.id,
    type: account.type,
    email: account.email,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    profile: account.profile || {},
    billing: account.billing || buildAccountBilling(account.type, account.profile?.plan || defaultAccountPlan(account.type)),
  };
}

function sanitizeSubmission(input) {
  const type = input.type === "hostel" ? "hostel" : "worker";
  const data = input.data && typeof input.data === "object" ? input.data : {};
  const plan = data.plan || (type === "hostel" ? "hostel-partner" : "worker-basic");

  return {
    id: crypto.randomUUID(),
    type,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    data: {
      ...data,
      plan,
    },
    payment: buildPaymentRecord(type, plan),
    notes: "",
  };
}

function publicSubmission(submission) {
  const { data } = submission;
  return {
    ...submission,
    data: {
      ...data,
    },
  };
}

function accountToPublishedHostel(account) {
  const profile = account.profile || {};
  return {
    id: account.id,
    type: "hostel",
    status: account.status,
    createdAt: account.createdAt,
    reviewedAt: account.updatedAt,
    source: "account",
    data: {
      name: profile.name || "Approved hostel",
      email: account.email,
      location: profile.location || "Location pending",
      website: profile.website || "",
      roles: normalizeList(profile.tags),
      startDate: profile.startDate || "",
      endDate: profile.endDate || "",
      plan: profile.plan || defaultAccountPlan("hostel"),
      description: profile.bio || "Details available after approval",
      photos: Array.isArray(profile.photos) ? profile.photos.slice(0, 10) : [],
    },
    payment: account.billing || buildAccountBilling("hostel", profile.plan || defaultAccountPlan("hostel")),
    notes: "",
  };
}

function toDbSubmission(submission) {
  return {
    id: submission.id,
    type: submission.type,
    status: submission.status,
    created_at: submission.createdAt,
    reviewed_at: submission.reviewedAt,
    data: submission.data,
    payment: submission.payment,
    notes: submission.notes || "",
  };
}

function fromDbSubmission(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    data: row.data || {},
    payment: row.payment || buildPaymentRecord(row.type, row.data?.plan),
    notes: row.notes || "",
  };
}

function useSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(tableAndQuery, options = {}) {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/${tableAndQuery}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || body?.error || "Supabase request failed");
  return body;
}

async function listSubmissions() {
  if (useSupabase()) {
    const rows = await supabaseRequest("submissions?select=*&order=created_at.desc");
    return rows.map(fromDbSubmission);
  }
  return readJson(SUBMISSIONS_FILE, []);
}

async function listAccounts() {
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest("accounts?select=*&order=created_at.desc");
      return rows.map(fromDbAccount);
    } catch (error) {
      console.warn(`Account storage fallback: ${error.message}`);
    }
  }
  return readJson(ACCOUNTS_FILE, []);
}

async function findAccountByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest(`accounts?email=eq.${encodeURIComponent(normalized)}&select=*&limit=1`);
      return rows[0] ? fromDbAccount(rows[0]) : null;
    } catch (error) {
      console.warn(`Account storage fallback: ${error.message}`);
    }
  }
  const accounts = await readJson(ACCOUNTS_FILE, []);
  return accounts.find((account) => account.email === normalized) || null;
}

async function findAccountById(id) {
  if (!id) return null;
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest(`accounts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
      return rows[0] ? fromDbAccount(rows[0]) : null;
    } catch (error) {
      console.warn(`Account storage fallback: ${error.message}`);
    }
  }
  const accounts = await readJson(ACCOUNTS_FILE, []);
  return accounts.find((account) => account.id === id) || null;
}

async function saveAccount(account) {
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest("accounts", {
        method: "POST",
        headers: { prefer: "return=representation" },
        body: JSON.stringify(toDbAccount(account)),
      });
      return fromDbAccount(rows[0]);
    } catch (error) {
      console.warn(`Account storage fallback: ${error.message}`);
    }
  }
  const accounts = await readJson(ACCOUNTS_FILE, []);
  accounts.unshift(account);
  await writeJson(ACCOUNTS_FILE, accounts);
  return account;
}

async function replaceAccount(id, updater) {
  const accounts = await listAccounts();
  let updated;
  const next = accounts.map((account) => {
    if (account.id !== id) return account;
    updated = updater(account);
    return updated;
  });
  if (!updated) return null;

  if (useSupabase()) {
    try {
      const rows = await supabaseRequest(`accounts?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { prefer: "return=representation" },
        body: JSON.stringify(toDbAccount(updated)),
      });
      return fromDbAccount(rows[0]);
    } catch (error) {
      console.warn(`Account storage fallback: ${error.message}`);
    }
  }

  await writeJson(ACCOUNTS_FILE, next);
  return updated;
}

async function saveSubmission(submission) {
  if (useSupabase()) {
    const rows = await supabaseRequest("submissions", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify(toDbSubmission(submission)),
    });
    return fromDbSubmission(rows[0]);
  }
  const submissions = await readJson(SUBMISSIONS_FILE, []);
  submissions.unshift(submission);
  await writeJson(SUBMISSIONS_FILE, submissions);
  return submission;
}

async function replaceSubmission(id, updater) {
  const submissions = await listSubmissions();
  let updated;
  const next = submissions.map((submission) => {
    if (submission.id !== id) return submission;
    updated = updater(submission);
    return updated;
  });
  if (!updated) return null;

  if (useSupabase()) {
    const rows = await supabaseRequest(`submissions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify(toDbSubmission(updated)),
    });
    return fromDbSubmission(rows[0]);
  }

  await writeJson(SUBMISSIONS_FILE, next);
  return updated;
}

async function deleteRejectedSubmissions() {
  if (useSupabase()) {
    await supabaseRequest("submissions?status=eq.rejected", { method: "DELETE" });
    return;
  }
  const submissions = await readJson(SUBMISSIONS_FILE, []);
  await writeJson(
    SUBMISSIONS_FILE,
    submissions.filter((submission) => submission.status !== "rejected")
  );
}

async function accountApplications(account) {
  const submissions = await listSubmissions();
  return submissions
    .filter((submission) => normalizeEmail(submission.data.email) === account.email)
    .map((submission) => ({
      id: submission.id,
      type: submission.type,
      status: submission.status,
      createdAt: submission.createdAt,
      planLabel: submission.payment?.planLabel || planDetails(submission.data.plan, submission.type).label,
    }));
}

async function accountPayload(account) {
  return {
    authenticated: true,
    account: publicAccount(account),
    applications: await accountApplications(account),
  };
}

async function accountFromRequest(req) {
  const token = parseCookies(req)[ACCOUNT_COOKIE];
  const accountId = token ? accountSessions.get(token) : null;
  return accountId ? findAccountById(accountId) : null;
}

async function addEmailOutbox(item) {
  if (useSupabase()) {
    await supabaseRequest("email_outbox", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        id: item.id,
        to_email: item.to,
        subject: item.subject,
        body: item.body,
        status: item.status,
        provider_id: item.providerId || null,
        created_at: item.createdAt,
      }),
    });
    return;
  }
  const outbox = await readJson(EMAIL_OUTBOX_FILE, []);
  outbox.unshift(item);
  await writeJson(EMAIL_OUTBOX_FILE, outbox);
}

async function stripeRequest(endpoint, body) {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Stripe request failed");
  return result;
}

async function createSignupCheckoutSession(req, submission) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const details = planDetails(submission.data.plan, submission.type);
  const origin = process.env.PUBLIC_BASE_URL || originFromReq(req);
  const session = await stripeRequest("checkout/sessions", {
    mode: "payment",
    success_url: `${origin}/payment-success.html?submission=${encodeURIComponent(submission.id)}`,
    cancel_url: `${origin}/index.html#join`,
    client_reference_id: submission.id,
    customer_email: submission.data.email,
    customer_creation: "always",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(details.signupFee * 100),
    "line_items[0][price_data][product_data][name]": `${details.label} signup fee`,
    "line_items[0][quantity]": "1",
    "payment_intent_data[setup_future_usage]": "off_session",
    "payment_intent_data[metadata][submission_id]": submission.id,
    "payment_intent_data[metadata][payment_type]": "signup_fee",
    "metadata[submission_id]": submission.id,
    "metadata[payment_type]": "signup_fee",
  });
  return session;
}

async function createMonthlySubscription(submission) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const details = planDetails(submission.data.plan, submission.type);
  if (!details.stripePriceId) {
    return { skipped: true, reason: "missing_price_id" };
  }
  if (!submission.payment?.stripeCustomerId) {
    return { skipped: true, reason: "missing_stripe_customer" };
  }
  return stripeRequest("subscriptions", {
    customer: submission.payment.stripeCustomerId,
    "items[0][price]": details.stripePriceId,
    payment_behavior: "default_incomplete",
    "metadata[submission_id]": submission.id,
    "metadata[plan]": submission.data.plan,
  });
}

function verifyStripeSignature(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return true;
  const parts = Object.fromEntries(
    String(signatureHeader || "")
      .split(",")
      .map((part) => part.split("="))
      .filter(([key, value]) => key && value)
  );
  if (!parts.t || !parts.v1) return false;
  const payload = `${parts.t}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parts.v1);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function handleStripeWebhook(req, res) {
  const rawBody = await readRawBody(req);
  if (!verifyStripeSignature(rawBody, req.headers["stripe-signature"])) {
    json(res, 400, { error: "Invalid Stripe signature" });
    return true;
  }
  const event = JSON.parse(rawBody.toString("utf8"));
  const session = event.data?.object;
  if (event.type === "checkout.session.completed" && session?.metadata?.submission_id) {
    await replaceSubmission(session.metadata.submission_id, (submission) => ({
      ...submission,
      payment: {
        ...submission.payment,
        signupFeeStatus: "paid",
        stripeCustomerId: session.customer || submission.payment?.stripeCustomerId || null,
        stripeCheckoutSessionId: session.id,
      },
    }));
  }
  json(res, 200, { received: true });
  return true;
}

async function sendLiveEmail({ to, subject, body }) {
  if (!process.env.RESEND_API_KEY) return null;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Hoppers <onboarding@resend.dev>",
      to: [to],
      subject,
      text: body,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Email provider request failed");
  return result;
}

async function queueEmail({ to, subject, body }) {
  if (!to) return null;
  const item = {
    id: crypto.randomUUID(),
    to,
    subject,
    body,
    status: "queued",
    providerId: null,
    createdAt: new Date().toISOString(),
  };
  try {
    const sent = await sendLiveEmail({ to, subject, body });
    if (sent) {
      item.status = "sent";
      item.providerId = sent.id || null;
    }
  } catch (error) {
    item.status = "failed";
    item.error = error.message;
  }
  await addEmailOutbox(item);
  return item;
}

async function notifySubmission(submission) {
  await queueEmail({
    to: submission.data.email,
    subject: "Hoppers received your profile",
    body: `Thanks for applying to Hoppers. Your ${submission.type} profile is pending review.`,
  });
  if (process.env.ADMIN_NOTIFICATION_EMAIL) {
    await queueEmail({
      to: process.env.ADMIN_NOTIFICATION_EMAIL,
      subject: "New Hoppers submission",
      body: `${submission.data.name || "Someone"} submitted a ${submission.type} profile for review.`,
    });
  }
}

async function notifyStatus(submission) {
  const approved = submission.status === "approved";
  await queueEmail({
    to: submission.data.email,
    subject: approved ? "Your Hoppers profile was approved" : "Hoppers profile update",
    body: approved
      ? `Your ${submission.payment.planLabel} profile was approved. Billing setup will be sent when payments are live.`
      : `Your Hoppers profile status changed to ${submission.status}.`,
  });
}

async function createDemoSubmission() {
  return sanitizeSubmission({
    type: "hostel",
    data: {
      name: "Harbor Steps Hostel",
      email: "hello@harborsteps.example",
      location: "Porto, Portugal",
      website: "https://example.com",
      roles: ["Reception", "Events"],
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      plan: "hostel-partner",
      description: "Staff bed, breakfast, three reception shifts per week, minimum stay of two months.",
    },
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/stripe/webhook" && req.method === "POST") {
    return handleStripeWebhook(req, res);
  }

  if (pathname === "/api/admin/session" && req.method === "GET") {
    json(res, 200, {
      authenticated: isAdmin(req),
      storage: useSupabase() ? "supabase" : "local-json",
      payments: process.env.STRIPE_SECRET_KEY ? "stripe" : "local-demo",
      email: process.env.RESEND_API_KEY ? "resend" : "local-outbox",
    });
    return true;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    json(res, 200, {
      ok: true,
      storage: useSupabase() ? "supabase" : "local-json",
      payments: process.env.STRIPE_SECRET_KEY ? "stripe" : "pre-stripe",
      email: process.env.RESEND_API_KEY ? "resend" : "local-outbox",
    });
    return true;
  }

  if (pathname === "/api/account/session" && req.method === "GET") {
    const account = await accountFromRequest(req);
    if (!account) {
      json(res, 200, { authenticated: false, account: null, applications: [] });
      return true;
    }
    json(res, 200, await accountPayload(account));
    return true;
  }

  if (pathname === "/api/account/register" && req.method === "POST") {
    if (!rateLimit(req, "account-register", 10, 60 * 60 * 1000)) {
      json(res, 429, { error: "Too many account attempts. Try again later." });
      return true;
    }
    const body = await readBody(req);
    const type = body.type === "hostel" ? "hostel" : "worker";
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const profile = sanitizeAccountProfile(body.profile || body, type);
    if (!email || !email.includes("@")) {
      json(res, 400, { error: "Enter a valid email address." });
      return true;
    }
    if (password.length < 8) {
      json(res, 400, { error: "Password must be at least 8 characters." });
      return true;
    }
    if (!profile.name) {
      json(res, 400, { error: "Enter a profile name." });
      return true;
    }
    if (await findAccountByEmail(email)) {
      json(res, 409, { error: "An account already exists for that email." });
      return true;
    }
    const now = new Date().toISOString();
    const account = await saveAccount({
      id: crypto.randomUUID(),
      type,
      email,
      ...hashPassword(password),
      status: "profile_draft",
      createdAt: now,
      updatedAt: now,
      profile,
      billing: buildAccountBilling(type, profile.plan || defaultAccountPlan(type)),
    });
    const token = crypto.randomBytes(32).toString("hex");
    accountSessions.set(token, account.id);
    json(
      res,
      201,
      await accountPayload(account),
      {
        "set-cookie": `${ACCOUNT_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`,
      }
    );
    return true;
  }

  if (pathname === "/api/account/login" && req.method === "POST") {
    if (!rateLimit(req, "account-login", 16, 15 * 60 * 1000)) {
      json(res, 429, { error: "Too many login attempts. Try again later." });
      return true;
    }
    const body = await readBody(req);
    const account = await findAccountByEmail(body.email);
    if (!account || !verifyPassword(body.password || "", account)) {
      json(res, 401, { error: "Email or password did not match." });
      return true;
    }
    const token = crypto.randomBytes(32).toString("hex");
    accountSessions.set(token, account.id);
    json(
      res,
      200,
      await accountPayload(account),
      {
        "set-cookie": `${ACCOUNT_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`,
      }
    );
    return true;
  }

  if (pathname === "/api/account/logout" && req.method === "POST") {
    const token = parseCookies(req)[ACCOUNT_COOKIE];
    if (token) accountSessions.delete(token);
    json(
      res,
      200,
      { authenticated: false },
      {
        "set-cookie": `${ACCOUNT_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      }
    );
    return true;
  }

  if (pathname === "/api/account/profile" && req.method === "PATCH") {
    const account = await accountFromRequest(req);
    if (!account) {
      json(res, 401, { error: "Account login required." });
      return true;
    }
    const body = await readBody(req);
    const updated = await replaceAccount(account.id, (current) => {
      const profile = sanitizeAccountProfile(body.profile || body, current.type, current.profile);
      return {
        ...current,
        updatedAt: new Date().toISOString(),
        profile,
        billing: buildAccountBilling(current.type, profile.plan || defaultAccountPlan(current.type)),
      };
    });
    json(res, 200, await accountPayload(updated));
    return true;
  }

  if (pathname === "/api/admin/login" && req.method === "POST") {
    if (!rateLimit(req, "admin-login", 8, 15 * 60 * 1000)) {
      json(res, 429, { error: "Too many login attempts. Try again later." });
      return true;
    }
    const body = await readBody(req);
    if (String(body.code || "").trim() !== ADMIN_CODE) {
      json(res, 401, { error: "Invalid admin code" });
      return true;
    }
    const token = crypto.randomBytes(32).toString("hex");
    sessions.add(token);
    json(
      res,
      200,
      { authenticated: true },
      {
        "set-cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`,
      }
    );
    return true;
  }

  if (pathname === "/api/admin/logout" && req.method === "POST") {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    json(
      res,
      200,
      { authenticated: false },
      {
        "set-cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      }
    );
    return true;
  }

  if (pathname === "/api/submissions" && req.method === "POST") {
    if (!rateLimit(req, "submission-create", 12, 60 * 60 * 1000)) {
      json(res, 429, { error: "Too many submissions. Try again later." });
      return true;
    }
    const body = await readBody(req);
    let submission = sanitizeSubmission(body);
    let checkoutSession = null;
    try {
      checkoutSession = await createSignupCheckoutSession(req, submission);
      if (checkoutSession) {
        submission.payment = {
          ...submission.payment,
          stripeCheckoutSessionId: checkoutSession.id,
        };
      }
    } catch (error) {
      submission.payment = {
        ...submission.payment,
        signupFeeStatus: "checkout_error",
        stripeError: error.message,
      };
    }
    submission = await saveSubmission(submission);
    await notifySubmission(submission);
    json(res, 201, {
      submission: publicSubmission(submission),
      checkoutUrl: checkoutSession?.url || null,
    });
    return true;
  }

  if (pathname === "/api/submissions" && req.method === "GET") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const submissions = await listSubmissions();
    json(res, 200, { submissions: submissions.map(publicSubmission) });
    return true;
  }

  if (pathname === "/api/admin/accounts" && req.method === "GET") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const accounts = await listAccounts();
    json(res, 200, { accounts: accounts.map(publicAccount) });
    return true;
  }

  const accountStatusMatch = pathname.match(/^\/api\/admin\/accounts\/([^/]+)\/status$/);
  if (accountStatusMatch && req.method === "PATCH") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const { status } = await readBody(req);
    if (!["profile_draft", "approved", "rejected"].includes(status)) {
      json(res, 400, { error: "Unsupported status" });
      return true;
    }
    const id = decodeURIComponent(accountStatusMatch[1]);
    const updated = await replaceAccount(id, (account) => {
      const billing = account.billing || buildAccountBilling(account.type, account.profile?.plan || defaultAccountPlan(account.type));
      return {
        ...account,
        status,
        updatedAt: new Date().toISOString(),
        billing: {
          ...billing,
          status:
            status === "approved"
              ? "approval_complete_billing_pending"
              : status === "rejected"
                ? "not_started"
                : "billing_setup_after_approval",
        },
      };
    });
    if (!updated) {
      json(res, 404, { error: "Account not found" });
      return true;
    }
    json(res, 200, { account: publicAccount(updated) });
    return true;
  }

  if (pathname === "/api/submissions/demo" && req.method === "POST") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const submission = await saveSubmission(await createDemoSubmission());
    json(res, 201, { submission: publicSubmission(submission) });
    return true;
  }

  if (pathname === "/api/submissions/rejected" && req.method === "DELETE") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    await deleteRejectedSubmissions();
    json(res, 200, { ok: true });
    return true;
  }

  const statusMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/status$/);
  if (statusMatch && req.method === "PATCH") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const { status } = await readBody(req);
    if (!["pending", "approved", "rejected"].includes(status)) {
      json(res, 400, { error: "Unsupported status" });
      return true;
    }
    const id = decodeURIComponent(statusMatch[1]);
    let subscription;
    let updated = await replaceSubmission(id, (submission) => {
      const payment = submission.payment || buildPaymentRecord(submission.type, submission.data.plan);
      const monthlyStatus =
        status === "approved"
          ? "approval_complete_billing_pending"
          : status === "rejected"
            ? "not_started"
            : "billing_setup_after_approval";
      return {
        ...submission,
        status,
        reviewedAt: new Date().toISOString(),
        payment: {
          ...payment,
          monthlyStatus,
        },
      };
    });
    if (!updated) {
      json(res, 404, { error: "Submission not found" });
      return true;
    }
    if (status === "approved") {
      subscription = await createMonthlySubscription(updated);
      updated = await replaceSubmission(id, (submission) => ({
        ...submission,
        payment: {
          ...submission.payment,
          monthlyStatus: subscription?.skipped ? "approval_complete_billing_pending" : subscription?.status || "active",
          stripeSubscriptionId: subscription?.id || submission.payment?.stripeSubscriptionId || null,
        },
      }));
    }
    await notifyStatus(updated);
    json(res, 200, { submission: publicSubmission(updated) });
    return true;
  }

  const notesMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/notes$/);
  if (notesMatch && req.method === "PATCH") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const { notes } = await readBody(req);
    const id = decodeURIComponent(notesMatch[1]);
    const updated = await replaceSubmission(id, (submission) => ({
      ...submission,
      notes: String(notes || ""),
    }));
    if (!updated) {
      json(res, 404, { error: "Submission not found" });
      return true;
    }
    json(res, 200, { submission: publicSubmission(updated) });
    return true;
  }

  if (pathname === "/api/published/hostels" && req.method === "GET") {
    const [submissions, accounts] = await Promise.all([listSubmissions(), listAccounts()]);
    const publishedSubmissions = submissions
      .filter((submission) => submission.type === "hostel" && submission.status === "approved")
      .map(publicSubmission);
    const publishedAccounts = accounts
      .filter((account) => account.type === "hostel" && account.status === "approved")
      .map(accountToPublishedHostel);
    json(res, 200, {
      hostels: [...publishedAccounts, ...publishedSubmissions],
    });
    return true;
  }

  return false;
}

async function serveStatic(req, res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);
  const relativePath = path.relative(ROOT, filePath);
  const pathParts = relativePath.split(path.sep);
  const extension = path.extname(filePath);
  const topDirectory = pathParts.length > 1 ? pathParts[0] : "";
  if (!filePath.startsWith(ROOT)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }
  if (
    relativePath.startsWith(".") ||
    pathParts.some((part) => part.startsWith(".")) ||
    !PUBLIC_FILE_EXTENSIONS.has(extension) ||
    !PUBLIC_DIRECTORIES.has(topDirectory)
  ) {
    json(res, 404, { error: "Not found" });
    return;
  }
  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(content);
  } catch {
    if (!path.extname(cleanPath)) {
      redirect(res, `${cleanPath}.html`);
      return;
    }
    json(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url.pathname);
      if (!handled) json(res, 404, { error: "API route not found" });
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Server error" });
  }
});

ensureDataFiles().then(() => {
  server.listen(PORT, () => {
    console.log(`Hoppers running at http://127.0.0.1:${PORT}`);
    console.log(`Storage: ${useSupabase() ? "Supabase" : "local JSON"}`);
    console.log(`Payments: ${process.env.STRIPE_SECRET_KEY ? "Stripe" : "local demo"}`);
    console.log(`Email: ${process.env.RESEND_API_KEY ? "Resend" : "local outbox"}`);
  });
});
