const loginSection = document.querySelector("#admin-login");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector(".admin-login-card");
const adminCode = document.querySelector("#admin-code");
const accountReviewList = document.querySelector("#account-review-list");
const submissionList = document.querySelector("#submission-list");
const listingList = document.querySelector("#listing-list");
const applicationReviewList = document.querySelector("#application-review-list");
const toast = document.querySelector("#toast");
const filterButtons = document.querySelectorAll("[data-filter]");
const viewButtons = document.querySelectorAll("[data-view]");
const seedDemoButton = document.querySelector("#seed-demo");
const logoutButton = document.querySelector("#logout-admin");
const clearRejectedButton = document.querySelector("#clear-rejected");
const recoverPaidForm = document.querySelector("#recover-paid-form");
const recoverPaidResult = document.querySelector("#recover-paid-result");
const recoveryRequestList = document.querySelector("#recovery-request-list");
const refreshRecoveryButton = document.querySelector("#refresh-recovery");

let activeFilter = "all";
let activeView = "accounts";
let cachedAccounts = [];
let cachedSubmissions = [];
let cachedApplications = [];
let cachedRecoveryRequests = [];
let cachedAdminStats = { deletedAccounts: 0, deletedWorkers: 0, deletedHostels: 0, recoveryRequests: 0 };
let statsRefreshTimer = null;

const paidStatuses = new Set(["paid", "complete", "completed", "succeeded", "active"]);
const subscribedStatuses = new Set(["active", "approved", "trialing"]);
const applicationStatuses = ["applied", "viewed", "shortlisted", "contacted", "interview", "accepted", "rejected", "withdrawn"];
const workerStatuses = ["new", "reviewed", "approved", "rejected", "matched", "placed"];
const hostelStatuses = ["lead", "contacted", "pilot", "active", "paying", "churned", "approved", "rejected"];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDateOnly(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function displayValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function profileList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function workerProfileCompletion(profile = {}) {
  const checks = [
    profile.photo,
    profile.startDate || profile.endDate,
    profileList(profile.preferredRegions).length,
    profileList(profile.tags).length,
    profileList(profile.languages).length,
    profile.experience || profileList(profile.previousHostels).length,
    profile.bio,
    profile.references,
    profile.workEligibilityAcknowledged,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function statusLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortStatus(value, successStatuses) {
  if (!value) return "Pending";
  const normalized = String(value).toLowerCase();
  if (successStatuses.has(normalized)) return "Yes";
  if (normalized.includes("pending")) return "Pending";
  return statusLabel(value);
}

function reviewStatus(status) {
  if (status === "approved" || status === "rejected") return status;
  return "pending";
}

function paymentRecord(type, plan, payment = {}) {
  const fallback =
    type === "hostel"
      ? { planLabel: "Hostel Partner", signupFee: 100, monthlyFee: 75 }
      : plan === "worker-premium"
        ? { planLabel: "Worker Premium", signupFee: 10, monthlyFee: 10 }
        : { planLabel: "Worker Basic", signupFee: 10, monthlyFee: 5 };
  return {
    planLabel: payment.planLabel || fallback.planLabel,
    signupFee: payment.signupFee ?? fallback.signupFee,
    monthlyFee: payment.monthlyFee ?? fallback.monthlyFee,
    status: payment.status || payment.monthlyStatus || "billing_setup_after_approval",
    provider: payment.provider || "local-demo",
  };
}

function syncRecoveryPlanOptions() {
  if (!recoverPaidForm) return;
  const type = recoverPaidForm.elements.type.value;
  const planSelect = recoverPaidForm.elements.plan;
  planSelect.querySelectorAll('option[value^="worker-"]').forEach((option) => {
    option.disabled = type === "hostel";
  });
  planSelect.querySelectorAll('option[value^="hostel-"]').forEach((option) => {
    option.disabled = type !== "hostel";
  });
  if (type === "worker" && !planSelect.value.startsWith("worker-")) planSelect.value = "worker-basic";
  if (type === "hostel" && !planSelect.value.startsWith("hostel-")) planSelect.value = "hostel-basic";
}

function splitLocation(value) {
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    city: parts[0] || "",
    country: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

function hostelRows() {
  const hostelAccountRows = cachedAccounts
    .filter((account) => account.type === "hostel")
    .map((account) => {
      const profile = account.profile || {};
      const location = splitLocation(profile.location);
      const payment = paymentRecord(account.type, profile.plan, account.billing);
      return {
        id: account.id,
        source: "account",
        status: account.status || "lead",
        reviewStatus: reviewStatus(account.status),
        name: profile.name || "Unnamed hostel",
        city: location.city,
        country: location.country,
        subscribed: shortStatus(account.billing?.monthlyStatus || payment.status, subscribedStatuses),
        paid: shortStatus(account.billing?.signupFeeStatus || payment.status, paidStatuses),
        phone: profile.phone || profile.contactNumber || "",
        email: account.email,
        details: accountRows(account),
        actionType: "account",
        adminNotes: profile.adminNotes || "",
      };
    });

  const hostelSubmissionRows = cachedSubmissions
    .filter((submission) => submission.type === "hostel")
    .map((submission) => {
      const data = submission.data || {};
      const location = splitLocation(data.location);
      const payment = paymentRecord(submission.type, data.plan, submission.payment);
      return {
        id: submission.id,
        source: "submission",
        status: submission.status || "pending",
        reviewStatus: reviewStatus(submission.status),
        name: data.name || "Unnamed hostel",
        city: location.city,
        country: location.country,
        subscribed: shortStatus(payment.monthlyStatus || payment.status, subscribedStatuses),
        paid: shortStatus(payment.signupFeeStatus || payment.status, paidStatuses),
        phone: data.phone || data.contactNumber || data.contact || "",
        email: data.email,
        details: submissionRows(submission),
        actionType: "submission",
        adminNotes: submission.notes || "",
      };
    });

  return [...hostelAccountRows, ...hostelSubmissionRows];
}

function workerRows() {
  return cachedAccounts
    .filter((account) => account.type === "worker")
    .map((account) => {
      const profile = account.profile || {};
      const location = splitLocation(profile.location);
      const payment = paymentRecord(account.type, profile.plan, account.billing);
      return {
        id: account.id,
        status: account.status || "new",
        reviewStatus: reviewStatus(account.status),
        name: profile.name || "Unnamed worker",
        city: location.city,
        country: location.country,
        nationality: profile.nationality || profile.website,
        completeness: workerProfileCompletion(profile),
        subscribed: shortStatus(account.billing?.monthlyStatus || payment.status, subscribedStatuses),
        paid: shortStatus(account.billing?.signupFeeStatus || payment.status, paidStatuses),
        phone: profile.phone || profile.contactNumber || "",
        email: account.email,
        details: accountRows(account),
        adminNotes: profile.adminNotes || "",
      };
    });
}

function listingRows() {
  return hostelRows().map((hostel) => {
    const sourceAccount = cachedAccounts.find((account) => account.id === hostel.id);
    const sourceSubmission = cachedSubmissions.find((submission) => submission.id === hostel.id);
    const profile = sourceAccount?.profile || {};
    const data = sourceSubmission?.data || {};
    return {
      ...hostel,
      role: displayValue(profile.tags || data.roles || data.role || "Role not listed"),
      startDate: formatDateOnly(profile.startDate || data.startDate),
      minimumStay: profile.minimumStay || data.minimumStay || data.duration || "Not listed",
      housing: profile.housingIncluded || data.housingIncluded ? "Yes" : "Confirm",
      meals: profile.mealsIncluded || data.mealsIncluded ? "Yes" : "Confirm",
      type: profile.compensation || data.compensation || data.type || "Confirm",
    };
  });
}

function sheetStatusClass(value) {
  return value === "Yes" ? "is-good" : "is-pending";
}

function detailRows(rows) {
  return rows
    .filter(([, value]) => (Array.isArray(value) ? value.length : value))
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>`)
    .join("");
}

function statusButtons(type, id, statuses, attribute) {
  return statuses
    .map(
      (status) =>
        `<button type="button" data-${attribute}-action="${escapeHtml(status)}" data-id="${escapeHtml(id)}">${escapeHtml(statusLabel(status))}</button>`
    )
    .join("");
}

function adminNoteBox(id, notes, attribute = "account-note-for") {
  return `
    <label class="admin-note-field">
      <span>Admin notes</span>
      <textarea data-${attribute}="${escapeHtml(id)}" placeholder="Add private admin notes">${escapeHtml(notes || "")}</textarea>
    </label>
  `;
}

function accountRows(account) {
  const profile = account.profile || {};
  const payment = paymentRecord(account.type, profile.plan, account.billing);
  const typeSpecificRows =
    account.type === "hostel"
      ? [["Website", profile.website]]
      : [["Nationality", profile.nationality || profile.website]];

  return detailRows([
    ["Email", account.email],
    ["Type", account.type],
    ["Location", profile.location],
    ...typeSpecificRows,
    ["Skills / roles", profile.tags],
    ["Start date", formatDateOnly(profile.startDate)],
    ["End date", formatDateOnly(profile.endDate)],
    ["Bio / details", profile.bio],
    ["Plan", payment.planLabel],
    ["Signup fee", `$${payment.signupFee} setup`],
    ["Monthly after approval", `$${payment.monthlyFee}/month`],
    ["Billing status", statusLabel(payment.status)],
    ["Payment mode", payment.provider],
    ["Password storage", account.security?.passwordLogin ? "Hashed and hidden" : "Not set"],
    ["Admin access", "Send reset link without viewing the password"],
  ]);
}

function submissionTitle(submission) {
  return submission.data.name || (submission.type === "hostel" ? "Unnamed hostel" : "Unnamed worker");
}

function submissionRows(submission) {
  const data = submission.data;
  const payment = paymentRecord(submission.type, data.plan, submission.payment);
  const rows =
    submission.type === "hostel"
      ? [
          ["Contact", data.email],
          ["Location", data.location],
          ["Website", data.website],
          ["Roles needed", data.roles || data.role],
          ["Start date", formatDateOnly(data.startDate)],
          ["End date", formatDateOnly(data.endDate)],
          ["Details", data.description],
        ]
      : [
          ["Contact", data.email],
          ["Location", data.location],
          ["Nationality", data.nationality],
          ["Skills", data.skills || data.skill],
          ["Start date", formatDateOnly(data.startDate)],
          ["End date", formatDateOnly(data.endDate)],
          ["Bio", data.bio],
        ];
  return detailRows([
    ...rows,
    ["Plan", payment.planLabel],
    ["Signup fee", `$${payment.signupFee} setup`],
    ["Monthly after approval", `$${payment.monthlyFee}/month`],
    ["Billing status", statusLabel(payment.status)],
    ["Payment mode", payment.provider],
  ]);
}

async function loadData() {
  const [{ accounts }, { submissions }, { applications }, { stats }, { requests }] = await Promise.all([
    fetchJson("/api/admin/accounts"),
    fetchJson("/api/submissions"),
    fetchJson("/api/admin/applications"),
    fetchJson("/api/admin/stats"),
    fetchJson("/api/admin/recovery-requests"),
  ]);
  cachedAccounts = accounts;
  cachedSubmissions = submissions;
  cachedApplications = applications || [];
  cachedRecoveryRequests = requests || [];
  cachedAdminStats = stats || cachedAdminStats;
}

async function refreshAdminStats() {
  const { stats } = await fetchJson("/api/admin/stats");
  cachedAdminStats = stats || cachedAdminStats;
  updateStats();
}

function visibleItems(items) {
  if (activeFilter === "all") return items;
  return items.filter((item) => reviewStatus(item.status) === activeFilter);
}

function updateStats() {
  const items =
    activeView === "accounts"
      ? workerRows()
      : activeView === "applications"
        ? cachedApplications
        : activeView === "listings"
          ? listingRows()
          : hostelRows();
  document.querySelector("#stat-pending").textContent = items.filter((item) => reviewStatus(item.status) === "pending").length;
  document.querySelector("#stat-approved").textContent = items.filter((item) => reviewStatus(item.status) === "approved").length;
  document.querySelector("#stat-rejected").textContent = items.filter((item) => reviewStatus(item.status) === "rejected").length;
  document.querySelector("#stat-deleted").textContent = cachedAdminStats.deletedAccounts || 0;
  document.querySelector("#stat-recovery").textContent = cachedAdminStats.recoveryRequests || cachedRecoveryRequests.length || 0;
}

function recoveryTypeLabel(value) {
  return value === "password" ? "Forgot password" : "Forgot username";
}

function recoveryAccountLabel(request) {
  const account = request.account;
  const metadata = request.metadata || {};
  if (account) {
    const profile = account.profile || {};
    return `${profile.name || account.email} (${statusLabel(account.type)})`;
  }
  return metadata.profileName || metadata.submittedEmail || request.targetEmail || "No exact match yet";
}

function recoveryDetailRows(request) {
  const metadata = request.metadata || {};
  const account = request.account;
  return detailRows([
    ["Submitted", formatDate(request.createdAt)],
    ["Request type", recoveryTypeLabel(metadata.requestType)],
    ["Matched account", account ? recoveryAccountLabel(request) : "Needs admin lookup"],
    ["Account email", account?.email || request.targetEmail || metadata.submittedEmail],
    ["Submitted account type", statusLabel(metadata.accountType || "Not sure")],
    ["Submitted profile name", metadata.profileName],
    ["Submitted contact", metadata.contact],
    ["Details", metadata.details],
  ]);
}

function renderRecoveryRequests() {
  if (!recoveryRequestList) return;
  recoveryRequestList.innerHTML = cachedRecoveryRequests.length
    ? cachedRecoveryRequests
        .map((request) => {
          const metadata = request.metadata || {};
          const account = request.account;
          return `
            <article class="recovery-request-card">
              <div>
                <p class="eyebrow">${escapeHtml(recoveryTypeLabel(metadata.requestType))}</p>
                <h3>${escapeHtml(recoveryAccountLabel(request))}</h3>
                <p>${escapeHtml(account ? "Account matched. Admin can create a reset link." : "No exact account match yet. Use the submitted details to look it up.")}</p>
              </div>
              <details class="sheet-more">
                <summary>Request details</summary>
                <dl class="sheet-details">${recoveryDetailRows(request)}</dl>
                <div class="sheet-actions">
                  ${
                    account
                      ? `<button type="button" data-recovery-reset data-id="${escapeHtml(account.id)}">Create reset link</button>`
                      : `<span class="recovery-unmatched">Search workers and hostel accounts above to match this request.</span>`
                  }
                </div>
              </details>
            </article>
          `;
        })
        .join("")
    : `<p class="empty-state">No forgot-login requests yet.</p>`;
}

function renderAccounts() {
  const visible = visibleItems(workerRows());
  accountReviewList.innerHTML = visible.length
    ? `
      <div class="admin-sheet" role="region" aria-label="Worker accounts spreadsheet" tabindex="0">
        <table>
          <thead>
            <tr>
              <th>Worker name</th>
              <th>More</th>
              <th>City</th>
              <th>Country</th>
              <th>Nationality</th>
              <th>Profile</th>
              <th>Status</th>
              <th>Subscribed</th>
              <th>Paid</th>
              <th>Contact number</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${visible
              .map(
                (worker) => `
                  <tr data-id="${escapeHtml(worker.id)}">
                    <td><strong>${escapeHtml(worker.name)}</strong></td>
                    <td>
                      <details class="sheet-more">
                        <summary>Details</summary>
                        <dl class="sheet-details">${worker.details}</dl>
                        <div class="sheet-actions">
                          ${statusButtons("worker", worker.id, workerStatuses, "account")}
                          <button type="button" data-account-reset data-id="${escapeHtml(worker.id)}">Send reset link</button>
                        </div>
                        ${adminNoteBox(worker.id, worker.adminNotes)}
                      </details>
                    </td>
                    <td>${escapeHtml(worker.city)}</td>
                    <td>${escapeHtml(worker.country)}</td>
                    <td>${escapeHtml(worker.nationality)}</td>
                    <td><span class="sheet-status ${worker.completeness >= 70 ? "is-good" : "is-pending"}">${escapeHtml(worker.completeness)}%</span></td>
                    <td>${escapeHtml(statusLabel(worker.status))}</td>
                    <td><span class="sheet-status ${sheetStatusClass(worker.subscribed)}">${escapeHtml(worker.subscribed)}</span></td>
                    <td><span class="sheet-status ${sheetStatusClass(worker.paid)}">${escapeHtml(worker.paid)}</span></td>
                    <td>${escapeHtml(worker.phone)}</td>
                    <td><a href="mailto:${escapeHtml(worker.email)}">${escapeHtml(worker.email)}</a></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p class="empty-state">No ${activeFilter === "all" ? "" : activeFilter} worker accounts yet.</p>`;
}

function renderHostelAccounts() {
  const visible = visibleItems(hostelRows());
  submissionList.innerHTML = visible.length
    ? `
      <div class="admin-sheet" role="region" aria-label="Hostel accounts spreadsheet" tabindex="0">
        <table>
          <thead>
            <tr>
              <th>Hostel name</th>
              <th>More</th>
              <th>City</th>
              <th>Country</th>
              <th>Status</th>
              <th>Subscribed</th>
              <th>Paid</th>
              <th>Contact number</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${visible
              .map(
                (hostel) => `
                  <tr data-id="${escapeHtml(hostel.id)}">
                    <td>
                      <strong>${escapeHtml(hostel.name)}</strong>
                      <span class="sheet-source">${escapeHtml(hostel.source === "account" ? "Created account" : "Legacy submission")}</span>
                    </td>
                    <td>
                      <details class="sheet-more">
                        <summary>Details</summary>
                        <dl class="sheet-details">${hostel.details}</dl>
                        <div class="sheet-actions">
                          ${
                            hostel.actionType === "account"
                              ? statusButtons("hostel", hostel.id, hostelStatuses, "account")
                              : `<button type="button" data-submission-action="approved" data-id="${escapeHtml(hostel.id)}">Approve</button><button type="button" data-submission-action="rejected" data-id="${escapeHtml(hostel.id)}">Reject</button><button type="button" data-submission-action="pending" data-id="${escapeHtml(hostel.id)}">Pending</button>`
                          }
                          ${hostel.actionType === "account" ? `<button type="button" data-account-reset data-id="${escapeHtml(hostel.id)}">Send reset link</button>` : ""}
                        </div>
                        ${hostel.actionType === "account" ? adminNoteBox(hostel.id, hostel.adminNotes) : adminNoteBox(hostel.id, hostel.adminNotes, "note-for")}
                      </details>
                    </td>
                    <td>${escapeHtml(hostel.city)}</td>
                    <td>${escapeHtml(hostel.country)}</td>
                    <td>${escapeHtml(statusLabel(hostel.status))}</td>
                    <td><span class="sheet-status ${sheetStatusClass(hostel.subscribed)}">${escapeHtml(hostel.subscribed)}</span></td>
                    <td><span class="sheet-status ${sheetStatusClass(hostel.paid)}">${escapeHtml(hostel.paid)}</span></td>
                    <td>${escapeHtml(hostel.phone)}</td>
                    <td><a href="mailto:${escapeHtml(hostel.email)}">${escapeHtml(hostel.email)}</a></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p class="empty-state">No ${activeFilter === "all" ? "" : activeFilter} hostel accounts yet.</p>`;
}

function renderListings() {
  const visible = visibleItems(listingRows());
  listingList.innerHTML = visible.length
    ? `
      <div class="admin-sheet" role="region" aria-label="Listings spreadsheet" tabindex="0">
        <table>
          <thead>
            <tr>
              <th>Hostel</th>
              <th>More</th>
              <th>City</th>
              <th>Country</th>
              <th>Role needed</th>
              <th>Start date</th>
              <th>Minimum stay</th>
              <th>Housing</th>
              <th>Meals</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${visible
              .map(
                (listing) => `
                  <tr>
                    <td><strong>${escapeHtml(listing.name)}</strong></td>
                    <td>
                      <details class="sheet-more">
                        <summary>Details</summary>
                        <dl class="sheet-details">${listing.details}</dl>
                        <div class="sheet-actions">
                          ${
                            listing.actionType === "account"
                              ? statusButtons("hostel", listing.id, hostelStatuses, "account")
                              : `<button type="button" data-submission-action="approved" data-id="${escapeHtml(listing.id)}">Approve listing</button><button type="button" data-submission-action="rejected" data-id="${escapeHtml(listing.id)}">Reject listing</button><button type="button" data-submission-action="pending" data-id="${escapeHtml(listing.id)}">Pending</button>`
                          }
                        </div>
                        ${listing.actionType === "account" ? adminNoteBox(listing.id, listing.adminNotes) : adminNoteBox(listing.id, listing.adminNotes, "note-for")}
                      </details>
                    </td>
                    <td>${escapeHtml(listing.city)}</td>
                    <td>${escapeHtml(listing.country)}</td>
                    <td>${escapeHtml(listing.role)}</td>
                    <td>${escapeHtml(listing.startDate || "Flexible")}</td>
                    <td>${escapeHtml(listing.minimumStay)}</td>
                    <td>${escapeHtml(listing.housing)}</td>
                    <td>${escapeHtml(listing.meals)}</td>
                    <td>${escapeHtml(listing.type)}</td>
                    <td>${escapeHtml(statusLabel(listing.status))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p class="empty-state">No hostel listings yet.</p>`;
}

function renderAdminApplications() {
  applicationReviewList.innerHTML = cachedApplications.length
    ? `
      <div class="admin-sheet" role="region" aria-label="Applications spreadsheet" tabindex="0">
        <table>
          <thead>
            <tr>
              <th>Worker</th>
              <th>More</th>
              <th>Hostel</th>
              <th>Role</th>
              <th>Location</th>
              <th>Status</th>
              <th>Profile</th>
              <th>Applied</th>
            </tr>
          </thead>
          <tbody>
            ${cachedApplications
              .map(
                (application) => `
                  <tr>
                    <td><strong>${escapeHtml(application.worker?.name || "Unnamed worker")}</strong></td>
                    <td>
                      <details class="sheet-more">
                        <summary>Details</summary>
                        <dl class="sheet-details">${detailRows([
                          ["Worker email", application.worker?.email || application.workerEmail],
                          ["Available", `${formatDateOnly(application.worker?.startDate)} - ${formatDateOnly(application.worker?.endDate)}`],
                          ["Worker roles", application.worker?.roles],
                          ["Hours/week", application.opening?.hoursPerWeek],
                          ["Minimum stay", application.opening?.minimumStay],
                          ["Housing", application.opening?.housingIncluded ? "Yes" : "No / confirm"],
                          ["Meals", application.opening?.mealsIncluded ? "Yes" : "No / confirm"],
                          ["Type", application.opening?.compensation],
                          ["Languages", application.opening?.languages],
                          ["Message", application.message],
                          ["Questions", application.questions],
                        ])}</dl>
                        <div class="sheet-actions">
                          ${statusButtons("application", application.id, applicationStatuses, "application")}
                        </div>
                        ${adminNoteBox(application.id, application.adminNotes, "application-note-for")}
                      </details>
                    </td>
                    <td>${escapeHtml(application.opening?.hostelName || "Hostel")}</td>
                    <td>${escapeHtml(application.opening?.role || application.opening?.title || "Role")}</td>
                    <td>${escapeHtml(application.opening?.location || "Location pending")}</td>
                    <td>${escapeHtml(statusLabel(application.status))}</td>
                    <td><span class="sheet-status ${(application.worker?.profileCompleteness || 0) >= 70 ? "is-good" : "is-pending"}">${escapeHtml(application.worker?.profileCompleteness ?? 0)}%</span></td>
                    <td>${escapeHtml(formatDate(application.createdAt))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<p class="empty-state">No worker applications yet.</p>`;
}

function renderDashboard() {
  updateStats();
  renderRecoveryRequests();
  accountReviewList.hidden = activeView !== "accounts";
  submissionList.hidden = activeView !== "submissions";
  listingList.hidden = activeView !== "listings";
  applicationReviewList.hidden = activeView !== "applications";
  clearRejectedButton.hidden = activeView !== "submissions" && activeView !== "listings";
  if (activeView === "accounts") renderAccounts();
  else if (activeView === "submissions") renderHostelAccounts();
  else if (activeView === "listings") renderListings();
  else renderAdminApplications();
}

async function refreshDashboard() {
  await loadData();
  renderDashboard();
}

async function openDashboard() {
  loginSection.hidden = true;
  dashboard.hidden = false;
  await refreshDashboard();
  if (!statsRefreshTimer) {
    statsRefreshTimer = window.setInterval(() => {
      if (!dashboard.hidden) refreshAdminStats().catch(() => {});
    }, 5000);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await fetchJson("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ code: adminCode.value.trim() }),
    });
    await openDashboard();
  } catch {
    showToast("That admin code did not match.");
  }
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    viewButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeView = button.dataset.view;
    renderDashboard();
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderDashboard();
  });
});

let noteTimer;
function handleNoteInput(event) {
  const id = event.target.dataset.noteFor;
  const accountId = event.target.dataset.accountNoteFor;
  const applicationId = event.target.dataset.applicationNoteFor;
  if (!id && !accountId && !applicationId) return;
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(async () => {
    try {
      if (id) {
        await fetchJson(`/api/submissions/${encodeURIComponent(id)}/notes`, {
          method: "PATCH",
          body: JSON.stringify({ notes: event.target.value }),
        });
      }
      if (accountId) {
        await fetchJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/notes`, {
          method: "PATCH",
          body: JSON.stringify({ notes: event.target.value }),
        });
      }
      if (applicationId) {
        await fetchJson(`/api/admin/applications/${encodeURIComponent(applicationId)}/notes`, {
          method: "PATCH",
          body: JSON.stringify({ notes: event.target.value }),
        });
      }
    } catch {
      showToast("Could not save admin note.");
    }
  }, 350);
}

submissionList.addEventListener("input", handleNoteInput);
accountReviewList.addEventListener("input", handleNoteInput);
listingList.addEventListener("input", handleNoteInput);
applicationReviewList.addEventListener("input", handleNoteInput);

async function updateAccountStatus(button) {
  if (!button) return;
  button.disabled = true;
  try {
    await fetchJson(`/api/admin/accounts/${encodeURIComponent(button.dataset.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: button.dataset.accountAction }),
    });
    await refreshDashboard();
    showToast(`Account moved to ${statusLabel(button.dataset.accountAction)}.`);
  } catch (error) {
    showToast(error.message || "Could not update account.");
  } finally {
    button.disabled = false;
  }
}

function showResetResult(button, result) {
  const actions = button.closest(".sheet-actions");
  if (!actions) return;
  let note = actions.querySelector(".reset-result");
  if (!note) {
    note = document.createElement("p");
    note.className = "reset-result";
    actions.append(note);
  }
  note.innerHTML = result.resetUrl
    ? `Email service is not connected yet. Test link: <a href="${escapeHtml(result.resetUrl)}">${escapeHtml(result.resetUrl)}</a>`
    : `Reset email sent to ${escapeHtml(result.email || "this account")}.`;
}

async function sendAccountReset(button) {
  if (!button) return;
  button.disabled = true;
  try {
    const result = await fetchJson(`/api/admin/accounts/${encodeURIComponent(button.dataset.id)}/password-reset`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    showResetResult(button, result);
    showToast(result.resetUrl ? "Reset link ready for testing." : "Password reset email sent.");
  } catch (error) {
    showToast(error.message || "Could not send reset link.");
  } finally {
    button.disabled = false;
  }
}

recoverPaidForm?.elements.type.addEventListener("change", syncRecoveryPlanOptions);

refreshRecoveryButton?.addEventListener("click", async () => {
  refreshRecoveryButton.disabled = true;
  try {
    await refreshDashboard();
    showToast("Recovery requests refreshed.");
  } catch (error) {
    showToast(error.message || "Could not refresh recovery requests.");
  } finally {
    refreshRecoveryButton.disabled = false;
  }
});

recoverPaidForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(recoverPaidForm);
  const button = recoverPaidForm.querySelector('button[type="submit"]');
  button.disabled = true;
  recoverPaidResult.textContent = "Checking Stripe...";
  try {
    const result = await fetchJson("/api/admin/accounts/recover-paid", {
      method: "POST",
      body: JSON.stringify({
        type: formData.get("type"),
        plan: formData.get("plan"),
        email: String(formData.get("email") || "").trim(),
        name: String(formData.get("name") || "").trim(),
        password: formData.get("password"),
        stripeCheckoutSessionId: String(formData.get("stripeCheckoutSessionId") || "").trim(),
      }),
    });
    recoverPaidResult.textContent = `${result.account?.email || "Account"} recovered. They can sign in with the temporary password.`;
    recoverPaidForm.reset();
    syncRecoveryPlanOptions();
    await refreshDashboard();
    showToast("Paid account recovered.");
  } catch (error) {
    recoverPaidResult.textContent = error.message || "Could not recover account.";
    showToast(error.message || "Could not recover account.");
  } finally {
    button.disabled = false;
  }
});

accountReviewList.addEventListener("click", async (event) => {
  const resetButton = event.target.closest("[data-account-reset]");
  if (resetButton) {
    await sendAccountReset(resetButton);
    return;
  }
  await updateAccountStatus(event.target.closest("[data-account-action]"));
});

async function handleHostelQueueClick(event) {
  const resetButton = event.target.closest("[data-account-reset]");
  if (resetButton) {
    await sendAccountReset(resetButton);
    return;
  }

  const accountButton = event.target.closest("[data-account-action]");
  if (accountButton) {
    await updateAccountStatus(accountButton);
    return;
  }

  const button = event.target.closest("[data-submission-action]");
  if (!button) return;
  button.disabled = true;
  try {
    await fetchJson(`/api/submissions/${encodeURIComponent(button.dataset.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: button.dataset.submissionAction }),
    });
    await refreshDashboard();
    showToast(`Submission moved to ${button.dataset.submissionAction}.`);
  } catch (error) {
    showToast(error.message || "Could not update submission.");
  } finally {
    button.disabled = false;
  }
}

submissionList.addEventListener("click", handleHostelQueueClick);
listingList.addEventListener("click", handleHostelQueueClick);

applicationReviewList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-application-action]");
  if (!button) return;
  button.disabled = true;
  try {
    await fetchJson(`/api/admin/applications/${encodeURIComponent(button.dataset.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: button.dataset.applicationAction }),
    });
    await refreshDashboard();
    showToast(`Application moved to ${statusLabel(button.dataset.applicationAction)}.`);
  } catch (error) {
    showToast(error.message || "Could not update application.");
  } finally {
    button.disabled = false;
  }
});

recoveryRequestList?.addEventListener("click", async (event) => {
  const resetButton = event.target.closest("[data-recovery-reset]");
  if (!resetButton) return;
  await sendAccountReset(resetButton);
});

seedDemoButton.addEventListener("click", async () => {
  seedDemoButton.disabled = true;
  try {
    await fetchJson("/api/submissions/demo", { method: "POST" });
    activeView = "submissions";
    viewButtons.forEach((item) => item.classList.toggle("active", item.dataset.view === "submissions"));
    await refreshDashboard();
    showToast("Demo hostel added to legacy submissions.");
  } catch (error) {
    showToast(error.message || "Could not add demo data.");
  } finally {
    seedDemoButton.disabled = false;
  }
});

clearRejectedButton.addEventListener("click", async () => {
  try {
    await fetchJson("/api/submissions/rejected", { method: "DELETE" });
    await refreshDashboard();
    showToast("Rejected submissions cleared.");
  } catch (error) {
    showToast(error.message || "Could not clear rejected submissions.");
  }
});

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/admin/logout", { method: "POST" }).catch(() => {});
  if (statsRefreshTimer) {
    window.clearInterval(statsRefreshTimer);
    statsRefreshTimer = null;
  }
  dashboard.hidden = true;
  loginSection.hidden = false;
  adminCode.value = "";
});

syncRecoveryPlanOptions();
