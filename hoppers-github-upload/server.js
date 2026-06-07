const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const tls = require("node:tls");

loadEnv();

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? path.join("/tmp", "hoppers-data") : path.join(ROOT, "data"));
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const EMAIL_OUTBOX_FILE = path.join(DATA_DIR, "email-outbox.json");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const PASSWORD_RESETS_FILE = path.join(DATA_DIR, "password-resets.json");
const ADMIN_ACTIONS_FILE = path.join(DATA_DIR, "admin-actions.json");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");
const ADMIN_CODE = process.env.ADMIN_CODE || "finntazer_69";
const SESSION_COOKIE = "hh_admin";
const ACCOUNT_COOKIE = "hh_account";
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const ACCOUNT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const sessions = new Set();
const accountSessions = new Map();
const rateBuckets = new Map();
const APPLICATION_STATUSES = new Set([
  "applied",
  "viewed",
  "shortlisted",
  "contacted",
  "interview",
  "accepted",
  "rejected",
  "withdrawn",
]);
const WORKER_REVIEW_STATUSES = new Set(["profile_draft", "new", "reviewed", "approved", "rejected", "matched", "placed"]);
const HOSTEL_REVIEW_STATUSES = new Set(["profile_draft", "lead", "contacted", "pilot", "active", "paying", "churned", "approved", "rejected"]);

const STRIPE_PAYMENT_LINK_IDS = {
  "worker-basic": process.env.STRIPE_WORKER_BASIC_PAYMENT_LINK_ID || "plink_1TbvRaJwdwooinLhcCKhRdpo",
  "worker-premium": process.env.STRIPE_WORKER_PREMIUM_PAYMENT_LINK_ID || "plink_1TbvSRJwdwooinLhMGKE1iGH",
  "hostel-basic": process.env.STRIPE_HOSTEL_BASIC_PAYMENT_LINK_ID || "plink_1TbvSyJwdwooinLhemGZ98DA",
  "hostel-premium": process.env.STRIPE_HOSTEL_PREMIUM_PAYMENT_LINK_ID || "plink_1TbvTJJwdwooinLhZ9tr5Nq5",
};

const PLAN_DETAILS = {
  "worker-basic": {
    label: "Worker Basic Plan",
    signupFee: 2.99,
    monthlyFee: 2.99,
    stripePriceId: process.env.STRIPE_WORKER_BASIC_PRICE_ID,
  },
  "worker-premium": {
    label: "Worker Premium Plan",
    signupFee: 5.99,
    monthlyFee: 5.99,
    stripePriceId: process.env.STRIPE_WORKER_PREMIUM_PRICE_ID,
  },
  "hostel-basic": {
    label: "Hostel Basic Plan",
    signupFee: 99,
    monthlyFee: 99,
    stripePriceId: process.env.STRIPE_HOSTEL_BASIC_PRICE_ID,
  },
  "hostel-premium": {
    label: "Hostel Premium Plan",
    signupFee: 199,
    monthlyFee: 199,
    stripePriceId: process.env.STRIPE_HOSTEL_PREMIUM_PRICE_ID,
  },
  "hostel-partner": {
    label: "Hostel Basic Plan",
    signupFee: 99,
    monthlyFee: 99,
    stripePriceId: process.env.STRIPE_HOSTEL_PARTNER_PRICE_ID,
  },
};

const PAYMENT_PAGES_BY_PLAN = {
  "worker-basic": "./payment-worker-basic.html",
  "worker-premium": "./payment-worker-premium.html",
  "hostel-basic": "./payment-hostel-basic.html",
  "hostel-premium": "./payment-hostel-premium.html",
  "hostel-partner": "./payment-hostel-basic.html",
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

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_CODE || ADMIN_CODE;
}

function signValue(value) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function createSignedToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, issuedAt: Date.now() })).toString("base64url");
  return `${body}.${signValue(body)}`;
}

function secureCookieSuffix(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return proto === "https" ? "; Secure" : "";
}

function accountCookie(req, token) {
  return `${ACCOUNT_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ACCOUNT_SESSION_MAX_AGE_SECONDS}${secureCookieSuffix(req)}`;
}

function clearAccountCookie(req) {
  return `${ACCOUNT_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookieSuffix(req)}`;
}

function readSignedToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = signValue(body);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function isAdmin(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const signed = readSignedToken(token);
  return Boolean((signed && signed.purpose === "admin") || (token && sessions.has(token)));
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
  await readJson(PASSWORD_RESETS_FILE, []);
  await readJson(ADMIN_ACTIONS_FILE, []);
  await readJson(APPLICATIONS_FILE, []);
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

function workerProfileCompletion(profile = {}) {
  const checks = [
    Boolean(profile.photo),
    Boolean(profile.startDate || profile.endDate),
    normalizeList(profile.preferredRegions).length > 0,
    normalizeList(profile.tags).length > 0,
    normalizeList(profile.languages).length > 0,
    Boolean(profile.experience || normalizeList(profile.previousHostels).length),
    Boolean(profile.bio),
    Boolean(profile.references),
    Boolean(profile.workEligibilityAcknowledged),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function defaultAccountPlan(type) {
  return type === "hostel" ? "hostel-basic" : "worker-basic";
}

function planDetails(plan, type) {
  return PLAN_DETAILS[plan] || PLAN_DETAILS[defaultAccountPlan(type)];
}

function normalizedPlan(plan, type) {
  if (!PLAN_DETAILS[plan]) return defaultAccountPlan(type);
  if (type === "worker" && !String(plan).startsWith("worker-")) return defaultAccountPlan(type);
  if (type === "hostel" && !String(plan).startsWith("hostel-")) return defaultAccountPlan(type);
  return plan;
}

function buildPaymentRecord(type, plan) {
  const normalized = normalizedPlan(plan, type);
  const details = planDetails(normalized, type);
  return {
    provider: process.env.STRIPE_SECRET_KEY ? "stripe" : "pre-stripe",
    plan: normalized,
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

function buildAccountBilling(type, plan, incoming = {}) {
  const normalized = normalizedPlan(plan || incoming.plan, type);
  const details = planDetails(normalized, type);
  const incomingStatus = String(incoming.status || "").toLowerCase();
  const billingStatus = ["paid", "payment_pending", "checkout_pending", "canceling", "canceled", "past_due", "incomplete", "billing_setup_after_approval"].includes(incomingStatus)
    ? incomingStatus
    : "";
  const paid = billingStatus === "paid";
  return {
    provider: billingStatus ? "stripe" : process.env.STRIPE_SECRET_KEY ? "stripe" : "pre-stripe",
    plan: normalized,
    planLabel: details.label,
    signupFee: details.signupFee,
    monthlyFee: details.monthlyFee,
    status: billingStatus || "billing_setup_after_approval",
    paidAt: paid ? String(incoming.paidAt || new Date().toISOString()) : incoming.paidAt || null,
    stripeCustomerId: incoming.stripeCustomerId || null,
    stripeCheckoutSessionId: incoming.stripeCheckoutSessionId || null,
    stripeSubscriptionId: incoming.stripeSubscriptionId || null,
    stripePaymentLinkId: incoming.stripePaymentLinkId || null,
    clientReferenceId: incoming.clientReferenceId || null,
    pendingSignupAt: incoming.pendingSignupAt || null,
    paymentPage: incoming.paymentPage || PAYMENT_PAGES_BY_PLAN[normalized] || null,
    subscriptionStatus: incoming.subscriptionStatus || null,
    cancelAtPeriodEnd: Boolean(incoming.cancelAtPeriodEnd),
    canceledAt: incoming.canceledAt || null,
    currentPeriodEnd: incoming.currentPeriodEnd || null,
    welcomedAt: incoming.welcomedAt || null,
    welcomeEmailStatus: incoming.welcomeEmailStatus || null,
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

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function resetTokenExpired(reset) {
  return !reset?.expiresAt || new Date(reset.expiresAt).getTime() <= Date.now();
}

function cleanRecoveryText(value, maxLength = 400) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizedLookup(value) {
  return cleanRecoveryText(value).toLowerCase();
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
    headline: type === "worker" ? String(profile.headline || existing.headline || "").trim() : "",
    languages: type === "worker" ? normalizeList(profile.languages || existing.languages) : [],
    previousHostels: type === "worker" ? normalizeList(profile.previousHostels || existing.previousHostels) : [],
    workCountries: type === "worker" ? normalizeList(profile.workCountries || existing.workCountries) : [],
    experience: type === "worker" ? String(profile.experience || existing.experience || "").trim() : "",
    education: type === "worker" ? String(profile.education || existing.education || "").trim() : "",
    certifications: type === "worker" ? normalizeList(profile.certifications || existing.certifications) : [],
    references: type === "worker" ? String(profile.references || existing.references || "").trim() : "",
    preferredRegions: type === "worker" ? normalizeList(profile.preferredRegions || existing.preferredRegions) : [],
    workStyle: type === "worker" ? String(profile.workStyle || existing.workStyle || "").trim() : "",
    portfolio: type === "worker" ? String(profile.portfolio || existing.portfolio || "").trim() : "",
    workEligibilityAcknowledged:
      type === "worker" ? Boolean(profile.workEligibilityAcknowledged || existing.workEligibilityAcknowledged) : false,
    phone: String(profile.phone || existing.phone || "").trim(),
    whatsapp: String(profile.whatsapp || existing.whatsapp || "").trim(),
    adminNotes: String(existing.adminNotes || profile.adminNotes || "").trim(),
    verification: profile.verification && typeof profile.verification === "object" ? profile.verification : existing.verification || {},
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

function clientProfile(profile = {}, includeAdmin = false) {
  if (includeAdmin) return profile || {};
  const { adminNotes, ...safeProfile } = profile || {};
  return safeProfile;
}

function publicAccount(account, options = {}) {
  const includeAdmin = Boolean(options.admin);
  return {
    id: account.id,
    type: account.type,
    email: account.email,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    profile: clientProfile(account.profile || {}, includeAdmin),
    billing: account.billing || buildAccountBilling(account.type, account.profile?.plan || defaultAccountPlan(account.type)),
    security: {
      passwordLogin: Boolean(account.passwordHash),
      canSendPasswordReset: true,
    },
  };
}

function safeClientReference(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 200);
}

function isDeletedAccount(account) {
  return account?.status === "deleted" || Boolean(account?.profile?.deletedAt);
}

function isPaymentPendingAccount(account) {
  const status = String(account?.status || "").toLowerCase();
  const billingStatus = String(account?.billing?.status || account?.billing?.signupFeeStatus || "").toLowerCase();
  return status === "payment_pending" || ["payment_pending", "checkout_pending"].includes(billingStatus);
}

function toDbPasswordReset(reset) {
  return {
    id: reset.id,
    account_id: reset.accountId,
    email: reset.email,
    token_hash: reset.tokenHash,
    expires_at: reset.expiresAt,
    used_at: reset.usedAt,
    requested_by: reset.requestedBy,
    requested_ip: reset.requestedIp,
    created_at: reset.createdAt,
  };
}

function fromDbPasswordReset(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    email: row.email,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    requestedBy: row.requested_by,
    requestedIp: row.requested_ip,
    createdAt: row.created_at,
  };
}

function toDbAdminAction(action) {
  return {
    id: action.id,
    action: action.action,
    account_id: action.accountId,
    target_email: action.targetEmail,
    metadata: action.metadata || {},
    created_at: action.createdAt,
  };
}

function fromDbAdminAction(row) {
  return {
    id: row.id,
    action: row.action,
    accountId: row.account_id,
    targetEmail: row.target_email,
    metadata: row.metadata || {},
    createdAt: row.created_at,
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
  const locationParts = String(profile.location || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
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
      city: locationParts.length > 1 ? locationParts.slice(0, -1).join(", ") : locationParts[0] || "",
      country: locationParts.length > 1 ? locationParts.at(-1) : "",
      website: profile.website || "",
      roles: normalizeList(profile.tags),
      startDate: profile.startDate || "",
      endDate: profile.endDate || "",
      minimumStay: profile.minimumStay || profile.duration || "",
      housingIncluded: Boolean(profile.housingIncluded || String(profile.bio || "").toLowerCase().includes("housing") || String(profile.bio || "").toLowerCase().includes("bed")),
      mealsIncluded: Boolean(profile.mealsIncluded || String(profile.bio || "").toLowerCase().includes("breakfast") || String(profile.bio || "").toLowerCase().includes("meal")),
      compensation: profile.compensation || profile.type || "Confirm with hostel",
      hoursPerWeek: profile.hoursPerWeek || "",
      languages: normalizeList(profile.languages),
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

function cleanApplicationText(value, maxLength = 1200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeApplicationStatus(status) {
  const value = String(status || "applied").toLowerCase();
  return APPLICATION_STATUSES.has(value) ? value : "applied";
}

function applicationLocation(opening = {}) {
  const city = String(opening.city || "").trim();
  const country = String(opening.country || "").trim();
  if (city && country) return `${city}, ${country}`;
  return String(opening.location || country || city || "Location pending").trim();
}

function sanitizeApplication(input, workerAccount) {
  const body = input && typeof input === "object" ? input : {};
  const opening = body.opening && typeof body.opening === "object" ? body.opening : {};
  const workerProfile = workerAccount.profile || {};
  const worker = body.worker && typeof body.worker === "object" ? body.worker : {};
  const role = cleanApplicationText(opening.role || opening.roleNeeded || opening.name || opening.title || "Hostel role", 160);
  const hostelName = cleanApplicationText(opening.hostelName || opening.hostel || opening.name || "Hostel", 160);
  const location = applicationLocation(opening);
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    status: "applied",
    createdAt: now,
    updatedAt: now,
    threadId: cleanApplicationText(body.threadId, 160),
    workerAccountId: workerAccount.id,
    workerEmail: workerAccount.email,
    worker: {
      name: cleanApplicationText(worker.name || workerProfile.name || "Worker", 160),
      email: normalizeEmail(worker.email || workerAccount.email),
      startDate: String(worker.startDate || workerProfile.startDate || "").trim(),
      endDate: String(worker.endDate || workerProfile.endDate || "").trim(),
      roles: cleanApplicationText(worker.roles || normalizeList(workerProfile.tags).join(", "), 300),
      profileCompleteness: workerProfileCompletion(workerProfile),
    },
    hostelAccountId: cleanApplicationText(opening.hostelAccountId || opening.accountId || (opening.source === "account" ? opening.id : ""), 160),
    hostelEmail: normalizeEmail(opening.hostelEmail || opening.email || ""),
    opening: {
      id: cleanApplicationText(opening.id, 160),
      source: cleanApplicationText(opening.source || (opening.sample ? "sample" : "published"), 80),
      hostelName,
      role,
      title: role,
      city: cleanApplicationText(opening.city, 120),
      country: cleanApplicationText(opening.country, 120),
      location,
      startDate: String(opening.startDate || "").trim(),
      startMonth: cleanApplicationText(opening.startMonth || opening.start || "", 80),
      minimumStay: cleanApplicationText(opening.minimumStay || opening.duration || opening.stay || "", 120),
      housingIncluded: Boolean(opening.housingIncluded),
      mealsIncluded: Boolean(opening.mealsIncluded),
      compensation: cleanApplicationText(opening.compensation || opening.type || "", 120),
      hoursPerWeek: cleanApplicationText(opening.hoursPerWeek || opening.hours || "", 80),
      languages: normalizeList(opening.languages || opening.languageRequirements),
      pilot: Boolean(opening.pilot || opening.sample || String(opening.status || "").toLowerCase().includes("pilot")),
    },
    message: cleanApplicationText(body.message, 1600),
    questions: cleanApplicationText(body.questions, 1200),
    adminNotes: "",
  };
}

function toDbApplication(application) {
  return {
    id: application.id,
    status: application.status,
    created_at: application.createdAt,
    updated_at: application.updatedAt,
    thread_id: application.threadId || null,
    worker_account_id: application.workerAccountId || null,
    worker_email: application.workerEmail || application.worker?.email || "",
    worker: application.worker || {},
    hostel_account_id: application.hostelAccountId || null,
    hostel_email: application.hostelEmail || "",
    opening: application.opening || {},
    message: application.message || "",
    questions: application.questions || "",
    admin_notes: application.adminNotes || "",
  };
}

function fromDbApplication(row) {
  return {
    id: row.id,
    status: normalizeApplicationStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    threadId: row.thread_id || "",
    workerAccountId: row.worker_account_id || "",
    workerEmail: row.worker_email || row.worker?.email || "",
    worker: row.worker || {},
    hostelAccountId: row.hostel_account_id || "",
    hostelEmail: row.hostel_email || "",
    opening: row.opening || {},
    message: row.message || "",
    questions: row.questions || "",
    adminNotes: row.admin_notes || "",
  };
}

function publicApplication(application) {
  return {
    id: application.id,
    status: normalizeApplicationStatus(application.status),
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    threadId: application.threadId || "",
    workerAccountId: application.workerAccountId || "",
    workerEmail: application.workerEmail || application.worker?.email || "",
    worker: application.worker || {},
    hostelAccountId: application.hostelAccountId || "",
    hostelEmail: application.hostelEmail || "",
    opening: application.opening || {},
    message: application.message || "",
    questions: application.questions || "",
    adminNotes: application.adminNotes || "",
  };
}

function useSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function productionRuntime() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function temporaryAccountStorageAllowed() {
  return process.env.ALLOW_TEMPORARY_ACCOUNT_STORAGE === "true" || !productionRuntime();
}

function exposeError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function handleAccountStorageFailure(area, error) {
  const message = error?.message || "Unknown storage error";
  if (!temporaryAccountStorageAllowed()) {
    throw exposeError(
      `${area} is not connected to permanent storage. Check Supabase before accepting or changing accounts.`,
      503
    );
  }
  console.warn(`${area} fallback: ${message}`);
}

function permanentAccountStorageReady() {
  return useSupabase() || temporaryAccountStorageAllowed();
}

function accountStorageStatus() {
  if (useSupabase()) return "supabase-permanent";
  if (temporaryAccountStorageAllowed()) return "local-json-dev";
  return "permanent-storage-required";
}

function paidSignupRequired() {
  return process.env.REQUIRE_PAID_SIGNUP !== "false";
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

async function listApplications() {
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest("applications?select=*&order=created_at.desc");
      return rows.map(fromDbApplication);
    } catch (error) {
      console.warn(`Application storage fallback: ${error.message}`);
    }
  }
  return readJson(APPLICATIONS_FILE, []);
}

async function saveApplication(application) {
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest("applications", {
        method: "POST",
        headers: { prefer: "return=representation" },
        body: JSON.stringify(toDbApplication(application)),
      });
      return fromDbApplication(rows[0]);
    } catch (error) {
      console.warn(`Application storage fallback: ${error.message}`);
    }
  }
  const applications = await readJson(APPLICATIONS_FILE, []);
  applications.unshift(application);
  await writeJson(APPLICATIONS_FILE, applications);
  return application;
}

async function replaceApplication(id, updater) {
  const applications = await listApplications();
  let updated;
  const next = applications.map((application) => {
    if (application.id !== id) return application;
    updated = updater(application);
    return updated;
  });
  if (!updated) return null;

  if (useSupabase()) {
    try {
      const rows = await supabaseRequest(`applications?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { prefer: "return=representation" },
        body: JSON.stringify(toDbApplication(updated)),
      });
      return fromDbApplication(rows[0]);
    } catch (error) {
      console.warn(`Application storage fallback: ${error.message}`);
    }
  }

  await writeJson(APPLICATIONS_FILE, next);
  return updated;
}

async function listAccounts() {
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest("accounts?select=*&order=created_at.desc");
      return rows.map(fromDbAccount);
    } catch (error) {
      handleAccountStorageFailure("Account storage", error);
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
      handleAccountStorageFailure("Account storage", error);
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
      handleAccountStorageFailure("Account storage", error);
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
      handleAccountStorageFailure("Account storage", error);
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
      handleAccountStorageFailure("Account storage", error);
    }
  }

  await writeJson(ACCOUNTS_FILE, next);
  return updated;
}

async function savePasswordReset(reset) {
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest("password_resets", {
        method: "POST",
        headers: { prefer: "return=representation" },
        body: JSON.stringify(toDbPasswordReset(reset)),
      });
      return fromDbPasswordReset(rows[0]);
    } catch (error) {
      handleAccountStorageFailure("Password reset storage", error);
    }
  }
  const resets = await readJson(PASSWORD_RESETS_FILE, []);
  const next = resets
    .filter((item) => !resetTokenExpired(item) && !item.usedAt)
    .concat(reset);
  await writeJson(PASSWORD_RESETS_FILE, next);
  return reset;
}

async function findPasswordResetByToken(token) {
  const tokenHash = hashResetToken(token);
  if (!token || !tokenHash) return null;
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest(`password_resets?token_hash=eq.${encodeURIComponent(tokenHash)}&select=*&limit=1`);
      return rows[0] ? fromDbPasswordReset(rows[0]) : null;
    } catch (error) {
      handleAccountStorageFailure("Password reset storage", error);
    }
  }
  const resets = await readJson(PASSWORD_RESETS_FILE, []);
  return resets.find((reset) => reset.tokenHash === tokenHash) || null;
}

async function markPasswordResetUsed(id) {
  const usedAt = new Date().toISOString();
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest(`password_resets?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { prefer: "return=representation" },
        body: JSON.stringify({ used_at: usedAt }),
      });
      return rows[0] ? fromDbPasswordReset(rows[0]) : null;
    } catch (error) {
      handleAccountStorageFailure("Password reset storage", error);
    }
  }
  const resets = await readJson(PASSWORD_RESETS_FILE, []);
  let updated = null;
  const next = resets.map((reset) => {
    if (reset.id !== id) return reset;
    updated = { ...reset, usedAt };
    return updated;
  });
  await writeJson(PASSWORD_RESETS_FILE, next);
  return updated;
}

async function logAdminAction({ action, accountId = null, targetEmail = "", metadata = {} }) {
  const item = {
    id: crypto.randomUUID(),
    action: String(action || "admin_action"),
    accountId,
    targetEmail: normalizeEmail(targetEmail),
    metadata,
    createdAt: new Date().toISOString(),
  };
  if (useSupabase()) {
    try {
      await supabaseRequest("admin_actions", {
        method: "POST",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify(toDbAdminAction(item)),
      });
      return item;
    } catch (error) {
      console.warn(`Admin action storage fallback: ${error.message}`);
    }
  }
  const actions = await readJson(ADMIN_ACTIONS_FILE, []);
  actions.unshift(item);
  await writeJson(ADMIN_ACTIONS_FILE, actions.slice(0, 1000));
  return item;
}

async function listAdminActions() {
  if (useSupabase()) {
    try {
      const rows = await supabaseRequest("admin_actions?select=*&order=created_at.desc");
      return rows.map(fromDbAdminAction);
    } catch (error) {
      console.warn(`Admin action read fallback: ${error.message}`);
    }
  }
  return readJson(ADMIN_ACTIONS_FILE, []);
}

async function adminStats() {
  const actions = await listAdminActions();
  const deleted = actions.filter((action) => action.action === "account_deleted");
  const recovery = actions.filter((action) => action.action === "account_recovery_requested");
  return {
    deletedAccounts: deleted.length,
    deletedWorkers: deleted.filter((action) => action.metadata?.accountType === "worker").length,
    deletedHostels: deleted.filter((action) => action.metadata?.accountType === "hostel").length,
    recoveryRequests: recovery.length,
  };
}

async function findRecoveryAccount({ email = "", type = "", profileName = "" }) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) return findAccountByEmail(normalizedEmail);

  const requestedType = type === "hostel" || type === "worker" ? type : "";
  const requestedName = normalizedLookup(profileName);
  if (!requestedName) return null;

  const accounts = await listAccounts();
  const matches = accounts.filter((account) => {
    if (requestedType && account.type !== requestedType) return false;
    return normalizedLookup(account.profile?.name) === requestedName;
  });
  return matches.length === 1 ? matches[0] : null;
}

async function logRecoveryRequest(req, { requestType, email = "", accountType = "", profileName = "", contact = "", details = "" }) {
  const account = await findRecoveryAccount({ email, type: accountType, profileName });
  return logAdminAction({
    action: "account_recovery_requested",
    accountId: account?.id || null,
    targetEmail: account?.email || email,
    metadata: {
      requestType,
      accountType,
      submittedEmail: normalizeEmail(email),
      profileName: cleanRecoveryText(profileName, 120),
      contact: cleanRecoveryText(contact, 120),
      details: cleanRecoveryText(details, 900),
      matchedAccountId: account?.id || null,
      matchedAccountType: account?.type || "",
      matchedAccountName: account?.profile?.name || "",
      requestedIp: clientIp(req),
    },
  });
}

async function adminRecoveryRequests() {
  const actions = (await listAdminActions()).filter((action) => action.action === "account_recovery_requested");
  const accountIds = new Set(actions.map((action) => action.accountId).filter(Boolean));
  const accounts = accountIds.size ? await listAccounts() : [];
  const accountById = new Map(accounts.map((account) => [account.id, publicAccount(account)]));
  return actions.slice(0, 100).map((action) => ({
    id: action.id,
    createdAt: action.createdAt,
    accountId: action.accountId,
    targetEmail: action.targetEmail,
    metadata: action.metadata || {},
    account: action.accountId ? accountById.get(action.accountId) || null : null,
  }));
}

function submissionBelongsToAccount(submission, account) {
  const email = normalizeEmail(account.email);
  const data = submission.data || {};
  return (
    normalizeEmail(data.email) === email ||
    String(data.accountId || data.workerAccountId || data.hostelAccountId || "") === String(account.id || "")
  );
}

async function deleteAccountData(account) {
  const email = normalizeEmail(account.email);
  const accountId = String(account.id || "");
  const submissions = await listSubmissions();
  const submissionIds = submissions.filter((submission) => submissionBelongsToAccount(submission, account)).map((submission) => submission.id);
  const applications = await listApplications();
  const applicationIds = applications
    .filter((application) => {
      if (account.type === "worker") {
        return application.workerAccountId === accountId || normalizeEmail(application.workerEmail || application.worker?.email) === email;
      }
      return application.hostelAccountId === accountId || normalizeEmail(application.hostelEmail) === email;
    })
    .map((application) => application.id);

  if (useSupabase()) {
    for (const submissionId of submissionIds) {
      await supabaseRequest(`submissions?id=eq.${encodeURIComponent(submissionId)}`, { method: "DELETE" });
    }
    for (const applicationId of applicationIds) {
      await supabaseRequest(`applications?id=eq.${encodeURIComponent(applicationId)}`, { method: "DELETE" }).catch((error) => {
        console.warn(`Application delete fallback: ${error.message}`);
      });
    }
    await supabaseRequest(`password_resets?account_id=eq.${encodeURIComponent(accountId)}`, { method: "DELETE" });
    if (email) await supabaseRequest(`password_resets?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
    if (email) await supabaseRequest(`email_outbox?to_email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
    await supabaseRequest(`admin_actions?account_id=eq.${encodeURIComponent(accountId)}`, { method: "DELETE" });
    if (email) await supabaseRequest(`admin_actions?target_email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
    await supabaseRequest(`accounts?id=eq.${encodeURIComponent(accountId)}`, { method: "DELETE" });
    return { submissionsDeleted: submissionIds.length, applicationsDeleted: applicationIds.length };
  }

  const accounts = await readJson(ACCOUNTS_FILE, []);
  await writeJson(
    ACCOUNTS_FILE,
    accounts.filter((item) => item.id !== accountId)
  );

  await writeJson(
    SUBMISSIONS_FILE,
    submissions.filter((submission) => !submissionIds.includes(submission.id))
  );

  await writeJson(
    APPLICATIONS_FILE,
    applications.filter((application) => !applicationIds.includes(application.id))
  );

  const resets = await readJson(PASSWORD_RESETS_FILE, []);
  await writeJson(
    PASSWORD_RESETS_FILE,
    resets.filter((reset) => reset.accountId !== accountId && normalizeEmail(reset.email) !== email)
  );

  const outbox = await readJson(EMAIL_OUTBOX_FILE, []);
  await writeJson(
    EMAIL_OUTBOX_FILE,
    outbox.filter((item) => normalizeEmail(item.to) !== email)
  );

  const actions = await readJson(ADMIN_ACTIONS_FILE, []);
  await writeJson(
    ADMIN_ACTIONS_FILE,
    actions.filter((action) => action.accountId !== accountId && normalizeEmail(action.targetEmail) !== email)
  );

  return { submissionsDeleted: submissionIds.length, applicationsDeleted: applicationIds.length };
}

async function recordAccountDeletion(account, deletion, subscription) {
  await logAdminAction({
    action: "account_deleted",
    accountId: null,
    targetEmail: "",
    metadata: {
      accountType: account.type,
      plan: account.billing?.plan || account.profile?.plan || defaultAccountPlan(account.type),
      stripeCancellation: subscription
        ? {
            status: subscription.status,
            cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
            currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          }
        : null,
      removed: deletion,
    },
  });

  const notifyEmail = normalizeEmail(process.env.ADMIN_NOTIFY_EMAIL);
  if (!notifyEmail) return;
  await addEmailOutbox({
    id: crypto.randomUUID(),
    to: notifyEmail,
    subject: "Hoppers account deleted",
    body: `A ${account.type} account deleted their Hoppers account. Stripe cancellation was ${subscription ? "sent" : "not needed"}.`,
    status: "queued",
    createdAt: new Date().toISOString(),
  });
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
  const [applications, submissions] = await Promise.all([listApplications(), listSubmissions()]);
  const email = normalizeEmail(account.email);
  const accountId = String(account.id || "");
  const profileName = String(account.profile?.name || "").toLowerCase();
  const records = applications.filter((application) => {
    if (account.type === "worker") {
      return application.workerAccountId === accountId || normalizeEmail(application.workerEmail || application.worker?.email) === email;
    }
    const hostelName = String(application.opening?.hostelName || application.opening?.name || "").toLowerCase();
    return (
      application.hostelAccountId === accountId ||
      normalizeEmail(application.hostelEmail) === email ||
      (profileName && hostelName === profileName)
    );
  });
  const submissionRecords = submissions
    .filter((submission) => normalizeEmail(submission.data.email) === email)
    .map((submission) => ({
      id: submission.id,
      type: submission.type,
      status: submission.status,
      createdAt: submission.createdAt,
      updatedAt: submission.reviewedAt || submission.createdAt,
      planLabel: submission.payment?.planLabel || planDetails(submission.data.plan, submission.type).label,
      source: "profile_submission",
      opening: {
        role: submission.type === "hostel" ? "Hostel profile submission" : "Worker profile submission",
        hostelName: submission.type === "hostel" ? submission.data.name || "Hostel profile" : "Hoppers review",
        location: submission.data.location || "Location pending",
      },
    }));
  return [...records.map(publicApplication), ...submissionRecords];
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
  const signed = readSignedToken(token);
  const accountId = signed?.purpose === "account" ? signed.accountId : token ? accountSessions.get(token) : null;
  const account = accountId ? await findAccountById(accountId) : null;
  return isDeletedAccount(account) || isPaymentPendingAccount(account) ? null : account;
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

async function stripeRequest(endpoint, body = {}, options = {}) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured yet.");
  const method = options.method || "POST";
  const url = new URL(`https://api.stripe.com/v1/${endpoint}`);
  const request = {
    method,
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    },
  };
  if (method === "GET") {
    Object.entries(body || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, item));
      else if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
  } else {
    request.headers["content-type"] = "application/x-www-form-urlencoded";
    request.body = new URLSearchParams(body);
  }
  const response = await fetch(url, request);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Stripe request failed");
  return result;
}

async function retrieveStripeCheckoutSession(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id || !id.startsWith("cs_")) return null;
  return stripeRequest(`checkout/sessions/${encodeURIComponent(id)}`, { "expand[]": "subscription" }, { method: "GET" });
}

function stripeObjectId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function stripePeriodEnd(subscription) {
  if (!subscription || typeof subscription !== "object") return null;
  const timestamp = subscription.current_period_end;
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function subscriptionHasPrice(subscription, priceId) {
  if (!priceId) return false;
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  return items.some((item) => item?.price?.id === priceId);
}

async function findStripeSubscriptionForAccount(account) {
  const existingSubscriptionId = account.billing?.stripeSubscriptionId;
  if (existingSubscriptionId) return { id: existingSubscriptionId };

  const customerId = account.billing?.stripeCustomerId;
  if (!customerId) return null;

  const plan = account.billing?.plan || account.profile?.plan || defaultAccountPlan(account.type);
  const expectedPriceId = planDetails(plan, account.type).stripePriceId;
  const result = await stripeRequest(
    "subscriptions",
    {
      customer: customerId,
      status: "all",
      limit: "10",
      "expand[]": "data.items.data.price",
    },
    { method: "GET" }
  );
  const subscriptions = Array.isArray(result?.data) ? result.data : [];
  const liveSubscriptions = subscriptions.filter((subscription) => !["canceled", "incomplete_expired"].includes(subscription.status));
  return (
    liveSubscriptions.find((subscription) => subscriptionHasPrice(subscription, expectedPriceId)) ||
    liveSubscriptions.find((subscription) => ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(subscription.status)) ||
    liveSubscriptions[0] ||
    null
  );
}

async function retrieveStripeSubscription(subscriptionId) {
  const id = String(subscriptionId || "").trim();
  if (!id || !id.startsWith("sub_")) return null;
  return stripeRequest(
    `subscriptions/${encodeURIComponent(id)}`,
    { "expand[]": "items.data.price" },
    { method: "GET" }
  );
}

function checkoutSessionEmail(session) {
  return normalizeEmail(session?.customer_details?.email || session?.customer_email || "");
}

function checkoutSessionPaid(session) {
  return session?.payment_status === "paid" || session?.status === "complete";
}

function checkoutSessionMatchesPlan(session, plan) {
  const expectedPaymentLink = STRIPE_PAYMENT_LINK_IDS[plan];
  const paymentLinkId = stripeObjectId(session?.payment_link);
  return !expectedPaymentLink || paymentLinkId === expectedPaymentLink;
}

function accountPlan(account) {
  return normalizedPlan(account?.billing?.plan || account?.profile?.plan, account?.type || "worker");
}

function checkoutMatchesAccountPlan(session, account) {
  const paymentLinkId = stripeObjectId(session?.payment_link);
  const expectedPaymentLink = STRIPE_PAYMENT_LINK_IDS[accountPlan(account)];
  return !paymentLinkId || !expectedPaymentLink || paymentLinkId === expectedPaymentLink;
}

async function findAccountForCheckoutSession(session, incomingReference = "") {
  const sessionId = String(session?.id || "").trim();
  const reference = safeClientReference(incomingReference || session?.client_reference_id || "");
  const paidEmail = checkoutSessionEmail(session);
  const accounts = await listAccounts();

  const exactSession = accounts.find((account) => !isDeletedAccount(account) && account.billing?.stripeCheckoutSessionId === sessionId);
  if (exactSession) return exactSession;

  const pendingAccounts = accounts.filter((account) => !isDeletedAccount(account) && isPaymentPendingAccount(account));
  if (reference) {
    const byReference = pendingAccounts.find((account) => safeClientReference(account.billing?.clientReferenceId) === reference);
    if (byReference && checkoutMatchesAccountPlan(session, byReference)) return byReference;
  }

  if (paidEmail) {
    return pendingAccounts.find((account) => account.email === paidEmail && checkoutMatchesAccountPlan(session, account)) || null;
  }

  return null;
}

async function findPaidCheckoutSessionForRecovery(email, plan, clientReferenceId = "") {
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) return null;
  const targetReference = safeClientReference(clientReferenceId);
  const createdAfter = Math.floor((Date.now() - 180 * 24 * 60 * 60 * 1000) / 1000);
  let startingAfter = "";
  for (let page = 0; page < 5; page += 1) {
    const query = {
      limit: "100",
      "created[gte]": String(createdAfter),
      "expand[]": "data.subscription",
    };
    if (startingAfter) query.starting_after = startingAfter;
    const result = await stripeRequest("checkout/sessions", query, { method: "GET" });
    const sessions = Array.isArray(result?.data) ? result.data : [];
    const matches = sessions.filter(
      (session) =>
        checkoutSessionPaid(session) &&
        checkoutSessionEmail(session) === targetEmail &&
        checkoutSessionMatchesPlan(session, plan)
    );
    const referenceMatch = targetReference
      ? matches.find((session) => safeClientReference(session.client_reference_id) === targetReference)
      : null;
    if (referenceMatch) return referenceMatch;
    if (!targetReference && matches[0]) return matches[0];
    if (!result?.has_more || !sessions.length) break;
    startingAfter = sessions.at(-1).id;
  }
  return null;
}

async function activatePaidSignupAccount(req, account, session, clientReferenceId = "") {
  if (!account || !session) throw new Error("Missing account or Stripe session.");
  const billing = await recoveredStripeBilling(account.type, account.email, accountPlan(account), session);
  const updated = await replaceAccount(account.id, (current) => ({
    ...current,
    status: "profile_draft",
    updatedAt: new Date().toISOString(),
    billing: {
      ...billing,
      clientReferenceId: safeClientReference(clientReferenceId || current.billing?.clientReferenceId || session.client_reference_id),
    },
  }));
  await maybeSendWelcomeEmail(updated);
  const token = createSignedToken({ purpose: "account", accountId: updated.id });
  accountSessions.set(token, updated.id);
  return { updated, token };
}

async function recoveredStripeBilling(type, email, plan, session) {
  if (!session || !checkoutSessionPaid(session)) {
    throw new Error("Stripe has not confirmed a paid checkout for this account.");
  }
  const normalized = normalizedPlan(plan, type);
  const paidEmail = checkoutSessionEmail(session);
  if (paidEmail !== normalizeEmail(email)) {
    throw new Error("Stripe payment email did not match the account email.");
  }
  if (!checkoutSessionMatchesPlan(session, normalized)) {
    throw new Error("Stripe payment did not match the selected Hoppers plan.");
  }
  let subscription = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
  if (!subscription && stripeObjectId(session.subscription)) {
    subscription = await retrieveStripeSubscription(stripeObjectId(session.subscription));
  }
  if (subscription && ["canceled", "incomplete_expired"].includes(subscription.status)) {
    throw new Error("The matching Stripe subscription is no longer active.");
  }
  return buildAccountBilling(type, normalized, {
    provider: "stripe",
    status: "paid",
    paidAt: session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString(),
    stripeCustomerId: stripeObjectId(session.customer),
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: stripeObjectId(session.subscription),
    stripePaymentLinkId: stripeObjectId(session.payment_link),
    subscriptionStatus: subscription?.status || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    currentPeriodEnd: stripePeriodEnd(subscription),
  });
}

async function verifiedStripeBilling(type, email, plan, incoming = {}) {
  const normalized = normalizedPlan(plan || incoming.plan, type);
  const sessionId = incoming.stripeCheckoutSessionId || incoming.checkoutSessionId || incoming.sessionId;
  if (!sessionId) {
    if (paidSignupRequired()) throw new Error("Stripe success session is missing. Payment links must return session_id.");
    return buildAccountBilling(type, normalized, incoming);
  }
  const session = await retrieveStripeCheckoutSession(sessionId);
  if (!session) throw new Error("Stripe checkout session was not found.");
  if (session.payment_status !== "paid" && session.status !== "complete") {
    throw new Error("Stripe has not confirmed this payment yet.");
  }
  const paidEmail = checkoutSessionEmail(session);
  if (paidEmail && email && paidEmail !== normalizeEmail(email)) {
    throw new Error("Stripe payment email did not match the account email.");
  }
  const expectedPaymentLink = STRIPE_PAYMENT_LINK_IDS[normalized];
  const paymentLinkId = stripeObjectId(session.payment_link);
  if (expectedPaymentLink && paymentLinkId && paymentLinkId !== expectedPaymentLink) {
    throw new Error("Stripe payment did not match the selected Hoppers plan.");
  }

  const subscription = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
  return buildAccountBilling(type, normalized, {
    ...incoming,
    provider: "stripe",
    status: "paid",
    paidAt: incoming.paidAt || new Date().toISOString(),
    stripeCustomerId: stripeObjectId(session.customer) || incoming.stripeCustomerId || null,
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: stripeObjectId(session.subscription) || incoming.stripeSubscriptionId || null,
    stripePaymentLinkId: stripeObjectId(session.payment_link) || incoming.stripePaymentLinkId || null,
    subscriptionStatus: subscription?.status || incoming.subscriptionStatus || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end || incoming.cancelAtPeriodEnd),
    currentPeriodEnd: stripePeriodEnd(subscription) || incoming.currentPeriodEnd || null,
  });
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
  if (event.type === "checkout.session.completed" && session?.id) {
    const account = await findAccountForCheckoutSession(session);
    if (account && (session.payment_status === "paid" || session.status === "complete")) {
      const subscription = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
      const updated = await replaceAccount(account.id, (current) => ({
        ...current,
        status: "profile_draft",
        updatedAt: new Date().toISOString(),
        billing: buildAccountBilling(current.type, current.billing?.plan || current.profile?.plan || defaultAccountPlan(current.type), {
          ...(current.billing || {}),
          provider: "stripe",
          status: "paid",
          paidAt: current.billing?.paidAt || new Date().toISOString(),
          stripeCustomerId: stripeObjectId(session.customer) || current.billing?.stripeCustomerId || null,
          stripeCheckoutSessionId: session.id,
          stripeSubscriptionId: stripeObjectId(session.subscription) || current.billing?.stripeSubscriptionId || null,
          stripePaymentLinkId: stripeObjectId(session.payment_link) || current.billing?.stripePaymentLinkId || null,
          clientReferenceId: safeClientReference(session.client_reference_id || current.billing?.clientReferenceId),
          subscriptionStatus: subscription?.status || current.billing?.subscriptionStatus || null,
          cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end || current.billing?.cancelAtPeriodEnd),
          currentPeriodEnd: stripePeriodEnd(subscription) || current.billing?.currentPeriodEnd || null,
        }),
      }));
      await maybeSendWelcomeEmail(updated);
    }
  }
  if ((event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") && session?.id) {
    const subscription = session;
    const accounts = await listAccounts();
    const account = accounts.find((item) => item.billing?.stripeSubscriptionId === subscription.id);
    if (account) {
      await replaceAccount(account.id, (current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        billing: buildAccountBilling(current.type, current.billing?.plan || current.profile?.plan || defaultAccountPlan(current.type), {
          ...(current.billing || {}),
          provider: "stripe",
          status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.cancel_at_period_end ? "canceling" : "paid",
          subscriptionStatus: subscription.status || current.billing?.subscriptionStatus || null,
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : current.billing?.canceledAt || null,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : current.billing?.currentPeriodEnd || null,
        }),
      }));
    }
  }
  json(res, 200, { received: true });
  return true;
}

async function sendLiveEmail({ to, subject, body }) {
  const provider = emailProvider();
  if (provider === "smtp") return sendSmtpEmail({ to, subject, body });
  if (provider !== "resend") return null;
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

function smtpSettings() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.GMAIL_EMAIL;
  const pass = String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  const host = process.env.SMTP_HOST || (user && user.endsWith("@gmail.com") ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT || 465);
  if (!host || !user || !pass) return null;
  return {
    host,
    port,
    user,
    pass,
    from: process.env.EMAIL_FROM || `Hoppers <${user}>`,
  };
}

function emailProvider() {
  if (smtpSettings()) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "local-outbox";
}

function sanitizeMailHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function emailAddressFromHeader(value) {
  const text = sanitizeMailHeader(value);
  const bracketed = text.match(/<([^<>]+)>/);
  return (bracketed ? bracketed[1] : text).trim();
}

function createSmtpReader(socket) {
  let buffer = "";
  let current = [];
  const responses = [];
  const waiters = [];

  function flushWaiter() {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(responses.shift());
  }

  socket.on("data", (chunk) => {
    buffer += chunk;
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd >= 0) {
      const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
      buffer = buffer.slice(lineEnd + 1);
      current.push(line);
      if (/^\d{3}(?:\s|$)/.test(line)) {
        responses.push(current.join("\n"));
        current = [];
        flushWaiter();
      }
      lineEnd = buffer.indexOf("\n");
    }
  });

  socket.on("error", (error) => {
    while (waiters.length) waiters.shift().reject(error);
  });

  socket.on("close", () => {
    while (waiters.length) waiters.shift().reject(new Error("SMTP connection closed before the mail server responded"));
  });

  return function readResponse() {
    if (responses.length) return Promise.resolve(responses.shift());
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  };
}

async function smtpCommand(socket, readResponse, command, expectedCodes) {
  socket.write(`${command}\r\n`);
  const response = await readResponse();
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP rejected ${command.split(" ")[0]}: ${response}`);
  }
  return response;
}

function dotStuff(body) {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

async function sendSmtpEmail({ to, subject, body }) {
  const settings = smtpSettings();
  if (!settings) return null;

  const socket = await new Promise((resolve, reject) => {
    const client = tls.connect(
      {
        host: settings.host,
        port: settings.port,
        servername: settings.host,
        rejectUnauthorized: true,
      },
      () => resolve(client)
    );
    client.once("error", reject);
    client.setTimeout(15000, () => {
      client.destroy(new Error("SMTP connection timed out"));
    });
  });

  const readResponse = createSmtpReader(socket);
  const fromAddress = emailAddressFromHeader(settings.from);
  const messageId = `<${crypto.randomUUID()}@hhopperr.com>`;
  const headers = [
    `From: ${sanitizeMailHeader(settings.from)}`,
    `To: ${sanitizeMailHeader(to)}`,
    `Subject: ${sanitizeMailHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
  ].join("\r\n");

  try {
    const greeting = await readResponse();
    if (Number(greeting.slice(0, 3)) !== 220) throw new Error(`SMTP greeting failed: ${greeting}`);
    await smtpCommand(socket, readResponse, "EHLO hhopperr.com", [250]);
    await smtpCommand(
      socket,
      readResponse,
      `AUTH PLAIN ${Buffer.from(`\u0000${settings.user}\u0000${settings.pass}`).toString("base64")}`,
      [235]
    );
    await smtpCommand(socket, readResponse, `MAIL FROM:<${fromAddress}>`, [250]);
    await smtpCommand(socket, readResponse, `RCPT TO:<${emailAddressFromHeader(to)}>`, [250, 251]);
    await smtpCommand(socket, readResponse, "DATA", [354]);
    socket.write(`${headers}\r\n\r\n${dotStuff(body)}\r\n.\r\n`);
    const dataResponse = await readResponse();
    if (Number(dataResponse.slice(0, 3)) !== 250) throw new Error(`SMTP rejected message: ${dataResponse}`);
    await smtpCommand(socket, readResponse, "QUIT", [221]);
    return { id: messageId, provider: "smtp" };
  } finally {
    socket.end();
  }
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

function passwordResetUrl(req, token) {
  const origin = process.env.PUBLIC_BASE_URL || originFromReq(req);
  return `${origin}/reset-password.html?token=${encodeURIComponent(token)}`;
}

async function createPasswordResetForAccount(req, account, requestedBy = "account") {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const reset = await savePasswordReset({
    id: crypto.randomUUID(),
    accountId: account.id,
    email: account.email,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS).toISOString(),
    usedAt: null,
    requestedBy,
    requestedIp: requestedBy === "account" ? clientIp(req) : "",
    createdAt: now.toISOString(),
  });
  const link = passwordResetUrl(req, token);
  const name = account.profile?.name || "there";
  const email = await queueEmail({
    to: account.email,
    subject: "Reset your Hoppers password",
    body:
      `Hi ${name},\n\n` +
      `Your Hoppers login email is ${account.email}.\n\n` +
      `Use this secure link to set a new password:\n${link}\n\n` +
      `This link expires in 1 hour and can only be used once. If you did not ask for this, you can ignore this email.`,
  });
  return { reset, resetUrl: link, email };
}

async function sendWelcomeEmail(account) {
  if (!account?.email) return null;
  if (account.type === "hostel") {
    return queueEmail({
      to: account.email,
      subject: "Welcome to the Hoppers pilot",
      body:
        "Thanks for joining Hoppers. Add your first role or tell us what kind of seasonal help you need. Hoppers helps introduce traveling workers, but hostels remain responsible for interviews, final decisions, role terms, housing, pay/exchange terms, and legal compliance.",
    });
  }
  return queueEmail({
    to: account.email,
    subject: "Welcome to Hoppers",
    body:
      "Thanks for joining Hoppers. Complete your profile so hostels can understand your dates, skills, and ideal placement. Hoppers does not guarantee jobs, visas, pay, housing, or employment. Hostels make final decisions and are responsible for role terms and legal compliance.",
  });
}

async function maybeSendWelcomeEmail(account) {
  if (!account || account.billing?.welcomedAt) return null;
  const email = await sendWelcomeEmail(account);
  await replaceAccount(account.id, (current) => ({
    ...current,
    updatedAt: new Date().toISOString(),
    billing: {
      ...(current.billing || {}),
      welcomedAt: new Date().toISOString(),
      welcomeEmailStatus: email?.status || "queued",
    },
  }));
  return email;
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
      accountStorage: accountStorageStatus(),
      payments: process.env.STRIPE_SECRET_KEY ? "stripe" : "local-demo",
      email: emailProvider(),
    });
    return true;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    json(res, 200, {
      ok: true,
      storage: useSupabase() ? "supabase" : "local-json",
      accountStorage: accountStorageStatus(),
      payments: process.env.STRIPE_SECRET_KEY ? "stripe" : "pre-stripe",
      email: emailProvider(),
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

	  if (pathname === "/api/account/forgot" && req.method === "POST") {
	    if (!rateLimit(req, "account-forgot", 8, 15 * 60 * 1000)) {
	      json(res, 429, { error: "Too many reset requests. Try again later." });
	      return true;
	    }
	    const body = await readBody(req);
	    const email = normalizeEmail(body.email);
	    if (email && email.includes("@")) {
	      const account = await findAccountByEmail(email);
	      if (account) await createPasswordResetForAccount(req, account, "account");
	      await logRecoveryRequest(req, {
	        requestType: "password",
	        email,
	        accountType: account?.type || "",
	        profileName: account?.profile?.name || "",
	        details: "Password reset requested from the public forgot login page.",
	      });
	    }
	    json(res, 200, {
	      ok: true,
	      message:
	        emailProvider() === "local-outbox"
	          ? "If that email is on Hoppers, your password request is now in the Hoppers admin recovery desk."
	          : "If that email is on Hoppers, we sent the login email and password reset link.",
	    });
	    return true;
	  }

	  if (pathname === "/api/account/recovery-request" && req.method === "POST") {
	    if (!rateLimit(req, "account-recovery-request", 8, 15 * 60 * 1000)) {
	      json(res, 429, { error: "Too many recovery requests. Try again later." });
	      return true;
	    }
	    const body = await readBody(req);
	    const requestType = body.requestType === "password" ? "password" : "username";
	    const accountType = body.accountType === "hostel" ? "hostel" : body.accountType === "worker" ? "worker" : "";
	    const email = normalizeEmail(body.email);
	    const profileName = cleanRecoveryText(body.profileName || body.name, 120);
	    const contact = cleanRecoveryText(body.contact || body.phone, 120);
	    const details = cleanRecoveryText(body.details, 900);

	    if (!email && !profileName && !contact) {
	      json(res, 400, { error: "Add an email, profile name, or contact number so Hoppers can find the account." });
	      return true;
	    }

	    await logRecoveryRequest(req, {
	      requestType,
	      email,
	      accountType,
	      profileName,
	      contact,
	      details,
	    });

	    json(res, 200, {
	      ok: true,
	      message: "Hoppers received your account recovery request. Admin can now look up the account and help with the username or password reset.",
	    });
	    return true;
	  }

  if (pathname === "/api/account/reset-password" && req.method === "POST") {
    if (!rateLimit(req, "account-reset-password", 10, 15 * 60 * 1000)) {
      json(res, 429, { error: "Too many reset attempts. Try again later." });
      return true;
    }
    const body = await readBody(req);
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    const reset = await findPasswordResetByToken(token);
    if (!reset || reset.usedAt || resetTokenExpired(reset)) {
      json(res, 400, { error: "This reset link is invalid or expired. Ask for a new reset email." });
      return true;
    }
    if (password.length < 8) {
      json(res, 400, { error: "Password must be at least 8 characters." });
      return true;
    }
    const account = (await findAccountById(reset.accountId)) || (await findAccountByEmail(reset.email));
    if (!account) {
      json(res, 400, { error: "This account could not be found. Ask Hoppers support for help." });
      return true;
    }
    const updated = await replaceAccount(account.id, (current) => ({
      ...current,
      ...hashPassword(password),
      updatedAt: new Date().toISOString(),
    }));
    await markPasswordResetUsed(reset.id);
    const sessionToken = createSignedToken({ purpose: "account", accountId: updated.id });
    accountSessions.set(sessionToken, updated.id);
    json(
      res,
      200,
      await accountPayload(updated),
      {
        "set-cookie": accountCookie(req, sessionToken),
      }
    );
    return true;
  }

  if (pathname === "/api/account/pending-signup" && req.method === "POST") {
    if (!permanentAccountStorageReady()) {
      json(res, 503, { error: "Permanent account storage is not connected yet. Add Supabase before accepting new paid accounts." });
      return true;
    }
    if (!rateLimit(req, "account-pending-signup", 12, 60 * 60 * 1000)) {
      json(res, 429, { error: "Too many account attempts. Try again later." });
      return true;
    }
    const body = await readBody(req);
    const type = body.type === "hostel" ? "hostel" : "worker";
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const profile = sanitizeAccountProfile(body.profile || body, type);
    const plan = normalizedPlan(profile.plan || body.plan || body.billing?.plan || defaultAccountPlan(type), type);
    profile.plan = plan;

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

    const existing = await findAccountByEmail(email);
    if (existing && !isPaymentPendingAccount(existing)) {
      json(res, 409, { error: "An account already exists for that email. Sign in instead." });
      return true;
    }

    const now = new Date().toISOString();
    const incomingReferenceId = safeClientReference(body.clientReferenceId || body.signupId || "");
    const existingReferenceId = safeClientReference(existing?.billing?.clientReferenceId || "");
    if (existing && isPaymentPendingAccount(existing) && existingReferenceId && existingReferenceId !== incomingReferenceId) {
      json(res, 409, {
        error:
          "A payment is already pending for that email. Finish the original payment flow, use forgot password, or contact Hoppers support so the paid account can be recovered safely.",
      });
      return true;
    }
    const clientReferenceId = incomingReferenceId || existingReferenceId || `hoppers_${crypto.randomUUID()}`;
    const billing = buildAccountBilling(type, plan, {
      ...(existing?.billing || {}),
      provider: "stripe",
      status: "payment_pending",
      clientReferenceId,
      pendingSignupAt: existing?.billing?.pendingSignupAt || now,
      paymentPage: PAYMENT_PAGES_BY_PLAN[plan] || "./payment.html",
      stripePaymentLinkId: STRIPE_PAYMENT_LINK_IDS[plan] || existing?.billing?.stripePaymentLinkId || null,
    });
    const accountData = {
      type,
      email,
      ...hashPassword(password),
      status: "payment_pending",
      updatedAt: now,
      profile,
      billing,
    };
    const account = existing
      ? await replaceAccount(existing.id, (current) => ({ ...current, ...accountData, createdAt: current.createdAt || now }))
      : await saveAccount({ id: crypto.randomUUID(), createdAt: now, ...accountData });

    json(res, existing ? 200 : 201, {
      ok: true,
      account: publicAccount(account),
      accountId: account.id,
      clientReferenceId,
      paymentPage: PAYMENT_PAGES_BY_PLAN[plan] || "./payment.html",
    });
    return true;
  }

  if (pathname === "/api/account/complete-paid-signup" && req.method === "POST") {
    if (!permanentAccountStorageReady()) {
      json(res, 503, { error: "Permanent account storage is not connected yet. Add Supabase before accepting new paid accounts." });
      return true;
    }
    if (!rateLimit(req, "account-complete-paid-signup", 20, 60 * 60 * 1000)) {
      json(res, 429, { error: "Too many payment checks. Try again later." });
      return true;
    }
    const body = await readBody(req);
    const sessionId = body.stripeCheckoutSessionId || body.checkoutSessionId || body.sessionId;
    let session;
    try {
      session = await retrieveStripeCheckoutSession(sessionId);
    } catch (error) {
      json(res, 402, { error: error.message || "Stripe checkout session could not be checked." });
      return true;
    }
    if (!session) {
      json(res, 402, { error: "Stripe success session is missing. Hoppers cannot activate the account without a verified Stripe session." });
      return true;
    }
    if (session.payment_status !== "paid" && session.status !== "complete") {
      json(res, 402, { error: "Stripe has not confirmed this payment yet." });
      return true;
    }

    const account = await findAccountForCheckoutSession(session, body.clientReferenceId || body.signupId);
    if (!account) {
      json(res, 409, {
        error: "Payment was verified, but Hoppers could not find the saved signup details. Do not pay again. Contact Hoppers with the Stripe receipt email so the account can be recovered.",
      });
      return true;
    }

    try {
      const { updated, token } = await activatePaidSignupAccount(
        req,
        account,
        session,
        account.billing?.clientReferenceId || body.clientReferenceId || session.client_reference_id
      );
      json(
        res,
        200,
        await accountPayload(updated),
        {
          "set-cookie": accountCookie(req, token),
        }
      );
    } catch (error) {
      json(res, 402, { error: error.message || "Stripe payment could not be verified." });
    }
    return true;
  }

  if (pathname === "/api/account/recover-paid-signup" && req.method === "POST") {
    if (!permanentAccountStorageReady()) {
      json(res, 503, { error: "Permanent account storage is not connected yet. Add Supabase before accepting new paid accounts." });
      return true;
    }
    if (!rateLimit(req, "account-recover-paid-signup", 12, 60 * 60 * 1000)) {
      json(res, 429, { error: "Too many payment recovery checks. Try again later." });
      return true;
    }
    const body = await readBody(req);
    const clientReferenceId = safeClientReference(body.clientReferenceId || body.signupId || "");
    const sessionId = String(body.stripeCheckoutSessionId || body.checkoutSessionId || body.sessionId || "").trim();
    const email = normalizeEmail(body.email);
    if (!clientReferenceId && !sessionId) {
      json(res, 400, { error: "Open payment from the Hoppers signup flow so we can safely match the Stripe payment to the saved account." });
      return true;
    }

    const pendingAccounts = (await listAccounts()).filter((account) => !isDeletedAccount(account) && isPaymentPendingAccount(account));
    const account =
      (clientReferenceId
        ? pendingAccounts.find((item) => safeClientReference(item.billing?.clientReferenceId) === clientReferenceId)
        : null) ||
      (sessionId && email ? pendingAccounts.find((item) => item.email === email) : null);

    if (!account) {
      json(res, 404, { error: "Hoppers could not find the pending signup for this payment. Contact Hoppers with the Stripe receipt email." });
      return true;
    }
    if (email && account.email !== email) {
      json(res, 409, { error: "The pending signup email did not match this payment recovery request." });
      return true;
    }

    let session;
    try {
      session = sessionId
        ? await retrieveStripeCheckoutSession(sessionId)
        : await findPaidCheckoutSessionForRecovery(account.email, accountPlan(account), clientReferenceId);
      if (!session) {
        json(res, 404, { error: "Stripe has not returned a paid checkout for this signup yet. If your card was charged, wait a moment and try again." });
        return true;
      }
      const sessionReference = safeClientReference(session.client_reference_id);
      if (clientReferenceId && sessionReference && sessionReference !== clientReferenceId) {
        json(res, 409, { error: "The Stripe payment did not match the saved Hoppers signup reference." });
        return true;
      }
      const { updated, token } = await activatePaidSignupAccount(req, account, session, clientReferenceId);
      await logAdminAction({
        action: "paid_signup_recovered",
        accountId: updated.id,
        targetEmail: updated.email,
        metadata: {
          accountType: updated.type,
          plan: accountPlan(updated),
          stripeCheckoutSessionId: session.id,
          clientReferenceId,
        },
      });
      json(
        res,
        200,
        await accountPayload(updated),
        {
          "set-cookie": accountCookie(req, token),
        }
      );
    } catch (error) {
      json(res, 502, { error: error.message || "Could not recover the paid signup." });
    }
    return true;
  }

  if (pathname === "/api/account/register" && req.method === "POST") {
    if (!permanentAccountStorageReady()) {
      json(res, 503, { error: "Permanent account storage is not connected yet. Add Supabase before accepting new paid accounts." });
      return true;
    }
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
    const existing = await findAccountByEmail(email);
    if (existing && !isPaymentPendingAccount(existing)) {
      json(res, 409, { error: "An account already exists for that email." });
      return true;
    }
    let billing;
    try {
      billing = await verifiedStripeBilling(type, email, profile.plan || body.billing?.plan || defaultAccountPlan(type), body.billing || {});
    } catch (error) {
      json(res, 402, { error: error.message || "Stripe payment could not be verified." });
      return true;
    }
    if (paidSignupRequired() && billing.status !== "paid") {
      json(res, 402, { error: "A verified Stripe payment is required before Hoppers creates this account." });
      return true;
    }
    const now = new Date().toISOString();
    const accountData = {
      type,
      email,
      ...hashPassword(password),
      status: "profile_draft",
      updatedAt: now,
      profile,
      billing,
    };
    const account = existing
      ? await replaceAccount(existing.id, (current) => ({ ...current, ...accountData, createdAt: current.createdAt || now }))
      : await saveAccount({
          id: crypto.randomUUID(),
          createdAt: now,
          ...accountData,
        });
    await maybeSendWelcomeEmail(account);
    const token = createSignedToken({ purpose: "account", accountId: account.id });
    accountSessions.set(token, account.id);
    json(
      res,
      201,
      await accountPayload(account),
      {
        "set-cookie": accountCookie(req, token),
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
    if (isDeletedAccount(account)) {
      json(res, 403, { error: "This Hoppers account has been deleted. Contact Hoppers support if this was a mistake." });
      return true;
    }
    if (isPaymentPendingAccount(account)) {
      json(res, 402, { error: "Payment is not finished yet. Return to the Hoppers payment page to activate this account." });
      return true;
    }
    const token = createSignedToken({ purpose: "account", accountId: account.id });
    accountSessions.set(token, account.id);
    json(
      res,
      200,
      await accountPayload(account),
      {
        "set-cookie": accountCookie(req, token),
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
        "set-cookie": clearAccountCookie(req),
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
        billing: buildAccountBilling(current.type, profile.plan || defaultAccountPlan(current.type), current.billing || {}),
      };
    });
    json(res, 200, await accountPayload(updated));
    return true;
  }

  if (pathname === "/api/account/billing-portal" && req.method === "POST") {
    const account = await accountFromRequest(req);
    if (!account) {
      json(res, 401, { error: "Account login required." });
      return true;
    }
    const customerId = account.billing?.stripeCustomerId;
    if (!customerId) {
      json(res, 409, { error: "This account is not connected to a Stripe customer yet." });
      return true;
    }
    try {
      const origin = process.env.PUBLIC_BASE_URL || originFromReq(req);
      const session = await stripeRequest("billing_portal/sessions", {
        customer: customerId,
        return_url: `${origin}/account.html?billing=updated`,
      });
      json(res, 200, { url: session.url });
    } catch (error) {
      json(res, 502, { error: error.message || "Could not open Stripe billing portal." });
    }
    return true;
  }

  if ((pathname === "/api/account/delete-account" || pathname === "/api/account/cancel-membership") && req.method === "POST") {
    const account = await accountFromRequest(req);
    if (!account) {
      json(res, 401, { error: "Account login required." });
      return true;
    }
    const body = await readBody(req);
    if (body.confirm !== true) {
      json(res, 400, { error: "Confirm account deletion before closing this account." });
      return true;
    }
    try {
      const hasStripeBilling = Boolean(account.billing?.stripeCustomerId || account.billing?.stripeSubscriptionId);
      const hasRecordedSubscription = Boolean(account.billing?.stripeSubscriptionId);
      const matchedSubscription = await findStripeSubscriptionForAccount(account);
      const subscriptionId = matchedSubscription?.id;
      if (hasRecordedSubscription && !subscriptionId) {
        json(res, 409, { error: "Hoppers could not find the active Stripe subscription. Open Manage subscription in Stripe or contact support before deleting the account." });
        return true;
      }
      const subscription = subscriptionId
        ? await stripeRequest(`subscriptions/${encodeURIComponent(subscriptionId)}`, {
            cancel_at_period_end: "true",
          })
        : null;
      const deletion = await deleteAccountData(account);
      await recordAccountDeletion(account, deletion, subscription);
      const token = parseCookies(req)[ACCOUNT_COOKIE];
      if (token) accountSessions.delete(token);
      json(
        res,
        200,
        {
          authenticated: false,
          deleted: true,
          accountId: null,
          removed: deletion,
          cancellation: subscription
            ? {
                status: subscription.status,
                cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
                currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
              }
            : null,
        },
        {
          "set-cookie": clearAccountCookie(req),
        }
      );
    } catch (error) {
      json(res, 502, { error: error.message || "Could not delete account or cancel Stripe subscription." });
    }
    return true;
  }

  if (pathname === "/api/applications" && req.method === "POST") {
    const account = await accountFromRequest(req);
    if (!account || account.type !== "worker") {
      json(res, 401, { error: "A worker account is required before applying." });
      return true;
    }
    const body = await readBody(req);
    const application = await saveApplication(sanitizeApplication(body, account));
    json(res, 201, { application: publicApplication(application) });
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
    const token = createSignedToken({ purpose: "admin" });
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
    json(res, 200, { accounts: accounts.map((account) => publicAccount(account, { admin: true })) });
    return true;
  }

  if (pathname === "/api/admin/applications" && req.method === "GET") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const applications = await listApplications();
    json(res, 200, { applications: applications.map(publicApplication) });
    return true;
  }

	  if (pathname === "/api/admin/stats" && req.method === "GET") {
	    if (!isAdmin(req)) {
	      json(res, 401, { error: "Admin login required" });
	      return true;
	    }
	    json(res, 200, { stats: await adminStats() });
	    return true;
	  }

	  if (pathname === "/api/admin/recovery-requests" && req.method === "GET") {
	    if (!isAdmin(req)) {
	      json(res, 401, { error: "Admin login required" });
	      return true;
	    }
	    json(res, 200, { requests: await adminRecoveryRequests() });
	    return true;
	  }

	  if (pathname === "/api/admin/accounts/recover-paid" && req.method === "POST") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    if (!permanentAccountStorageReady()) {
      json(res, 503, { error: "Permanent account storage is not connected yet. Add Supabase before recovering paid accounts." });
      return true;
    }
    if (!rateLimit(req, "admin-recover-paid-account", 12, 60 * 60 * 1000)) {
      json(res, 429, { error: "Too many recovery attempts. Try again later." });
      return true;
    }
    const body = await readBody(req);
    const type = body.type === "hostel" ? "hostel" : "worker";
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const plan = normalizedPlan(body.plan || defaultAccountPlan(type), type);
    const profile = sanitizeAccountProfile(
      {
        ...(body.profile || {}),
        name: body.name || body.profile?.name,
        plan,
      },
      type
    );

    if (!email || !email.includes("@")) {
      json(res, 400, { error: "Enter the Stripe receipt email." });
      return true;
    }
    if (password.length < 8) {
      json(res, 400, { error: "Temporary password must be at least 8 characters." });
      return true;
    }
    if (!profile.name) {
      json(res, 400, { error: "Enter a profile name for the recovered account." });
      return true;
    }

    const existing = await findAccountByEmail(email);
    if (existing && !isPaymentPendingAccount(existing)) {
      json(res, 409, { error: "A Hoppers account already exists for that email. Use the admin password reset button instead." });
      return true;
    }

    let session;
    let billing;
    try {
      const sessionId = String(body.stripeCheckoutSessionId || body.checkoutSessionId || body.sessionId || "").trim();
      session = sessionId ? await retrieveStripeCheckoutSession(sessionId) : await findPaidCheckoutSessionForRecovery(email, plan);
      if (!session) {
        json(res, 404, { error: "No paid Stripe checkout was found for that email and plan. Check the receipt email and plan, or use the Stripe session ID if you have it." });
        return true;
      }
      billing = await recoveredStripeBilling(type, email, plan, session);
    } catch (error) {
      json(res, 502, { error: error.message || "Could not verify the Stripe payment." });
      return true;
    }

    const now = new Date().toISOString();
    const accountData = {
      type,
      email,
      ...hashPassword(password),
      status: "profile_draft",
      updatedAt: now,
      profile,
      billing,
    };
    const account = existing
      ? await replaceAccount(existing.id, (current) => ({ ...current, ...accountData, createdAt: current.createdAt || now }))
      : await saveAccount({ id: crypto.randomUUID(), createdAt: now, ...accountData });
    await maybeSendWelcomeEmail(account);

    await logAdminAction({
      action: "paid_account_recovered",
      accountId: account.id,
      targetEmail: account.email,
      metadata: {
        accountType: type,
        plan,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: stripeObjectId(session.customer),
        stripeSubscriptionId: stripeObjectId(session.subscription),
      },
    });

    json(res, existing ? 200 : 201, {
      ok: true,
      account: publicAccount(account),
      recoveredFromStripe: {
        checkoutSessionId: session.id,
        customerId: stripeObjectId(session.customer),
        subscriptionId: stripeObjectId(session.subscription),
      },
      message: "Recovered account created. The member can now sign in with the temporary password you set.",
    });
    return true;
  }

  const accountResetMatch = pathname.match(/^\/api\/admin\/accounts\/([^/]+)\/password-reset$/);
  if (accountResetMatch && req.method === "POST") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const account = await findAccountById(decodeURIComponent(accountResetMatch[1]));
    if (!account) {
      json(res, 404, { error: "Account not found" });
      return true;
    }
    const result = await createPasswordResetForAccount(req, account, "admin");
    await logAdminAction({
      action: "password_reset_sent",
      accountId: account.id,
      targetEmail: account.email,
      metadata: {
        emailStatus: result.email?.status || "queued",
        resetId: result.reset?.id || null,
      },
    });
    const emailSent = result.email?.status === "sent";
    json(res, 200, {
      ok: true,
      email: account.email,
      emailStatus: result.email?.status || "queued",
      resetUrl: emailSent ? null : result.resetUrl,
      message: emailSent
        ? "Password reset email sent."
        : "Email service is not connected or failed; the reset link is saved in the outbox and shown here for testing.",
    });
    return true;
  }

  const accountStatusMatch = pathname.match(/^\/api\/admin\/accounts\/([^/]+)\/status$/);
  if (accountStatusMatch && req.method === "PATCH") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const { status } = await readBody(req);
    const id = decodeURIComponent(accountStatusMatch[1]);
    const account = await findAccountById(id);
    if (!account) {
      json(res, 404, { error: "Account not found" });
      return true;
    }
    const allowedStatuses = account.type === "hostel" ? HOSTEL_REVIEW_STATUSES : WORKER_REVIEW_STATUSES;
    if (!allowedStatuses.has(status)) {
      json(res, 400, { error: "Unsupported status" });
      return true;
    }
    const updated = await replaceAccount(id, (account) => {
      const billing = account.billing || buildAccountBilling(account.type, account.profile?.plan || defaultAccountPlan(account.type));
      return {
        ...account,
        status,
        updatedAt: new Date().toISOString(),
        billing: {
          ...billing,
          status:
            billing.status === "paid"
              ? "paid"
              : status === "approved"
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
    await logAdminAction({
      action: "account_status_changed",
      accountId: updated.id,
      targetEmail: updated.email,
      metadata: { status },
    });
    json(res, 200, { account: publicAccount(updated) });
    return true;
  }

  const accountNotesMatch = pathname.match(/^\/api\/admin\/accounts\/([^/]+)\/notes$/);
  if (accountNotesMatch && req.method === "PATCH") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const { notes } = await readBody(req);
    const id = decodeURIComponent(accountNotesMatch[1]);
    const updated = await replaceAccount(id, (account) => ({
      ...account,
      updatedAt: new Date().toISOString(),
      profile: {
        ...(account.profile || {}),
        adminNotes: String(notes || ""),
      },
    }));
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

  const applicationStatusMatch = pathname.match(/^\/api\/admin\/applications\/([^/]+)\/status$/);
  if (applicationStatusMatch && req.method === "PATCH") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const { status } = await readBody(req);
    const normalizedStatus = String(status || "").toLowerCase();
    if (!APPLICATION_STATUSES.has(normalizedStatus)) {
      json(res, 400, { error: "Unsupported status" });
      return true;
    }
    const id = decodeURIComponent(applicationStatusMatch[1]);
    const updated = await replaceApplication(id, (application) => ({
      ...application,
      status: normalizedStatus,
      updatedAt: new Date().toISOString(),
    }));
    if (!updated) {
      json(res, 404, { error: "Application not found" });
      return true;
    }
    json(res, 200, { application: publicApplication(updated) });
    return true;
  }

  const applicationNotesMatch = pathname.match(/^\/api\/admin\/applications\/([^/]+)\/notes$/);
  if (applicationNotesMatch && req.method === "PATCH") {
    if (!isAdmin(req)) {
      json(res, 401, { error: "Admin login required" });
      return true;
    }
    const { notes } = await readBody(req);
    const id = decodeURIComponent(applicationNotesMatch[1]);
    const updated = await replaceApplication(id, (application) => ({
      ...application,
      adminNotes: String(notes || ""),
      updatedAt: new Date().toISOString(),
    }));
    if (!updated) {
      json(res, 404, { error: "Application not found" });
      return true;
    }
    json(res, 200, { application: publicApplication(updated) });
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

const ready = ensureDataFiles();

async function handleRequest(req, res) {
  try {
    await ready;
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url.pathname);
      if (!handled) json(res, 404, { error: "API route not found" });
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, error.statusCode || 500, {
      error: error.expose ? error.message : "Server error",
    });
  }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  ready.then(() => {
    server.listen(PORT, () => {
      console.log(`Hoppers running at http://127.0.0.1:${PORT}`);
      console.log(`Storage: ${useSupabase() ? "Supabase" : "local JSON"}`);
      console.log(`Payments: ${process.env.STRIPE_SECRET_KEY ? "Stripe" : "local demo"}`);
      console.log(`Email: ${emailProvider()}`);
    });
  });
} else {
  module.exports = handleRequest;
}
