const loginSection = document.querySelector("#admin-login");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector(".admin-login-card");
const adminCode = document.querySelector("#admin-code");
const accountReviewList = document.querySelector("#account-review-list");
const submissionList = document.querySelector("#submission-list");
const toast = document.querySelector("#toast");
const filterButtons = document.querySelectorAll("[data-filter]");
const viewButtons = document.querySelectorAll("[data-view]");
const seedDemoButton = document.querySelector("#seed-demo");
const logoutButton = document.querySelector("#logout-admin");
const clearRejectedButton = document.querySelector("#clear-rejected");

let activeFilter = "all";
let activeView = "accounts";
let cachedAccounts = [];
let cachedSubmissions = [];

const paidStatuses = new Set(["paid", "complete", "completed", "succeeded", "active"]);
const subscribedStatuses = new Set(["active", "approved", "trialing"]);

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
        status: reviewStatus(account.status),
        name: profile.name || "Unnamed hostel",
        city: location.city,
        country: location.country,
        subscribed: shortStatus(account.billing?.monthlyStatus || payment.status, subscribedStatuses),
        paid: shortStatus(account.billing?.signupFeeStatus || payment.status, paidStatuses),
        phone: profile.phone || profile.contactNumber || "",
        email: account.email,
        details: accountRows(account),
        actionType: "account",
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
        status: reviewStatus(submission.status),
        name: data.name || "Unnamed hostel",
        city: location.city,
        country: location.country,
        subscribed: shortStatus(payment.monthlyStatus || payment.status, subscribedStatuses),
        paid: shortStatus(payment.signupFeeStatus || payment.status, paidStatuses),
        phone: data.phone || data.contactNumber || data.contact || "",
        email: data.email,
        details: submissionRows(submission),
        actionType: "submission",
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
        status: reviewStatus(account.status),
        name: profile.name || "Unnamed worker",
        city: location.city,
        country: location.country,
        nationality: profile.nationality || profile.website,
        subscribed: shortStatus(account.billing?.monthlyStatus || payment.status, subscribedStatuses),
        paid: shortStatus(account.billing?.signupFeeStatus || payment.status, paidStatuses),
        phone: profile.phone || profile.contactNumber || "",
        email: account.email,
        details: accountRows(account),
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
  const [{ accounts }, { submissions }] = await Promise.all([fetchJson("/api/admin/accounts"), fetchJson("/api/submissions")]);
  cachedAccounts = accounts;
  cachedSubmissions = submissions;
}

function visibleItems(items) {
  if (activeFilter === "all") return items;
  return items.filter((item) => reviewStatus(item.status) === activeFilter);
}

function updateStats() {
  const items = activeView === "accounts" ? workerRows() : hostelRows();
  document.querySelector("#stat-pending").textContent = items.filter((item) => reviewStatus(item.status) === "pending").length;
  document.querySelector("#stat-approved").textContent = items.filter((item) => reviewStatus(item.status) === "approved").length;
  document.querySelector("#stat-rejected").textContent = items.filter((item) => reviewStatus(item.status) === "rejected").length;
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
                          <button type="button" data-account-action="approved" data-id="${escapeHtml(worker.id)}">Approve</button>
                          <button type="button" data-account-action="rejected" data-id="${escapeHtml(worker.id)}">Reject</button>
                          <button type="button" data-account-action="profile_draft" data-id="${escapeHtml(worker.id)}">Draft</button>
                        </div>
                      </details>
                    </td>
                    <td>${escapeHtml(worker.city)}</td>
                    <td>${escapeHtml(worker.country)}</td>
                    <td>${escapeHtml(worker.nationality)}</td>
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
                          <button type="button" data-${hostel.actionType}-action="approved" data-id="${escapeHtml(hostel.id)}">Approve</button>
                          <button type="button" data-${hostel.actionType}-action="rejected" data-id="${escapeHtml(hostel.id)}">Reject</button>
                          <button type="button" data-${hostel.actionType}-action="${hostel.actionType === "account" ? "profile_draft" : "pending"}" data-id="${escapeHtml(hostel.id)}">${hostel.actionType === "account" ? "Draft" : "Pending"}</button>
                        </div>
                      </details>
                    </td>
                    <td>${escapeHtml(hostel.city)}</td>
                    <td>${escapeHtml(hostel.country)}</td>
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

function renderDashboard() {
  updateStats();
  accountReviewList.hidden = activeView !== "accounts";
  submissionList.hidden = activeView !== "submissions";
  clearRejectedButton.hidden = activeView !== "submissions";
  if (activeView === "accounts") renderAccounts();
  else renderHostelAccounts();
}

async function refreshDashboard() {
  await loadData();
  renderDashboard();
}

async function openDashboard() {
  loginSection.hidden = true;
  dashboard.hidden = false;
  await refreshDashboard();
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
submissionList.addEventListener("input", (event) => {
  const id = event.target.dataset.noteFor;
  if (!id) return;
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(async () => {
    try {
      await fetchJson(`/api/submissions/${encodeURIComponent(id)}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes: event.target.value }),
      });
    } catch {
      showToast("Could not save admin note.");
    }
  }, 350);
});

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

accountReviewList.addEventListener("click", async (event) => {
  await updateAccountStatus(event.target.closest("[data-account-action]"));
});

submissionList.addEventListener("click", async (event) => {
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
  dashboard.hidden = true;
  loginSection.hidden = false;
  adminCode.value = "";
});

