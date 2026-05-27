const fallbackOpenings = [
  {
    name: "Alpine Base Hostel",
    location: "Interlaken, Switzerland",
    needs: ["Housekeeping", "Breakfast", "Reception"],
    stay: "Short-term or seasonal",
    benefits: "Staff bed, breakfast, discounts",
    details:
      "A mountain base looking for practical help through busy guest weeks. Good for travelers who want a short stay, with room to extend if the fit is right.",
  },
  {
    name: "Canal House Hostel",
    location: "Amsterdam, Netherlands",
    needs: ["Reception", "Events", "Night shift"],
    stay: "Seasonal or longer-term",
    benefits: "Paid hourly role, staff meals",
    details:
      "A city hostel with structured shifts and guest-facing work. Best for someone comfortable with steady schedules, late arrivals, and staying through a longer stretch.",
  },
  {
    name: "Sunset Surf Hostel",
    location: "Lagos, Portugal",
    needs: ["Bar", "Tours", "Social media"],
    stay: "Short-term trial or longer stay",
    benefits: "Accommodation, breakfast, surf discounts",
    details:
      "A social hostel near the water with flexible role needs. Start with a shorter trial, then continue if the timing, team, and workload feel right.",
  },
];

const form = document.querySelector("#opening-application-form");
const applicationGate = document.querySelector("#application-gate");
const createWorkerAccount = document.querySelector("#create-worker-account");
const toast = document.querySelector("#toast");
let selectedOpening = fallbackOpenings[0];
let currentAccount = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function valuesList(value, fallback = "Role TBD") {
  if (Array.isArray(value)) return value.length ? value : [fallback];
  return value ? [value] : [fallback];
}

function formatDateOnly(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function dateRange(startDate, endDate) {
  const start = formatDateOnly(startDate);
  const end = formatDateOnly(endDate);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return "Flexible dates";
}

function submissionToOpening(submission) {
  return {
    name: submission.data.name || "Approved hostel",
    location: submission.data.location || "Location pending",
    needs: valuesList(submission.data.roles || submission.data.role),
    stay: dateRange(submission.data.startDate, submission.data.endDate),
    benefits: submission.data.description || "Details available after approval",
    details: submission.data.description || "More details will be shared after the hostel review is complete.",
  };
}

function openingKey(opening) {
  return `${opening.name}|${opening.location}`.toLowerCase();
}

async function openingOptions() {
  try {
    const { hostels } = await fetchJson("/api/published/hostels");
    const approved = hostels.map(submissionToOpening);
    return approved.length ? [...approved, ...fallbackOpenings] : fallbackOpenings;
  } catch {
    return fallbackOpenings;
  }
}

function renderOpening(opening) {
  document.querySelector("#apply-title").textContent = `Apply to ${opening.name}.`;
  document.querySelector("#apply-subtitle").textContent =
    "Send a clear first message and start a communication thread for the placement.";
  document.querySelector("#opening-brief-title").textContent = opening.name;
  document.querySelector("#opening-brief-location").textContent = `+ ${opening.location}`;
  document.querySelector("#opening-brief-stay").textContent = opening.stay || "Flexible dates";
  document.querySelector("#opening-brief-roles").innerHTML = valuesList(opening.needs)
    .map((item) => `<span class="badge">${escapeHtml(item)}</span>`)
    .join("");
  document.querySelector("#opening-brief-benefits").textContent = opening.benefits || opening.details || "";
}

function showApplicationGate(message) {
  applicationGate.hidden = false;
  form.hidden = true;
  if (message) applicationGate.querySelector("p:not(.eyebrow)").textContent = message;
  createWorkerAccount.href = `./account.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

function showApplicationForm(account) {
  applicationGate.hidden = true;
  form.hidden = false;
  const profile = account.profile || {};
  form.elements.name.value = profile.name || "";
  form.elements.email.value = account.email || "";
  form.elements.startDate.value = profile.startDate || "";
  form.elements.endDate.value = profile.endDate || "";
  form.elements.roles.value = Array.isArray(profile.tags) ? profile.tags.join(", ") : "";
}

async function requireWorkerAccount() {
  try {
    const session = await fetchJson("/api/account/session");
    if (!session.authenticated || !session.account) {
      showApplicationGate();
      return;
    }
    if (session.account.type !== "worker") {
      showApplicationGate("This opening needs a worker account to apply. Hostel accounts can review applications from their account dashboard.");
      return;
    }
    currentAccount = session.account;
    showApplicationForm(currentAccount);
  } catch {
    showApplicationGate();
  }
}

function storedThreads() {
  try {
    return JSON.parse(localStorage.getItem("hoppers_communications") || "[]");
  } catch {
    return [];
  }
}

function saveThreads(threads) {
  localStorage.setItem("hoppers_communications", JSON.stringify(threads));
}

function threadFromForm(formData) {
  const now = new Date().toISOString();
  const message = String(formData.get("message") || "").trim();
  const questions = String(formData.get("questions") || "").trim();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    status: "Application sent",
    createdAt: now,
    updatedAt: now,
    opening: selectedOpening,
    worker: {
      accountId: currentAccount?.id || "",
      name: String(formData.get("name") || currentAccount?.profile?.name || "").trim(),
      email: String(formData.get("email") || currentAccount?.email || "").trim(),
      startDate: String(formData.get("startDate") || ""),
      endDate: String(formData.get("endDate") || ""),
      roles: String(formData.get("roles") || "").trim(),
    },
    messages: [
      {
        role: "worker",
        sender: currentAccount?.profile?.name || "Worker",
        sentAt: now,
        body: message,
      },
      ...(questions
        ? [
            {
              role: "worker",
              sender: currentAccount?.profile?.name || "Worker",
              sentAt: now,
              body: questions,
            },
          ]
        : []),
      {
        role: "system",
        sender: "Hoppers",
        sentAt: now,
        body:
          "Application saved. Next, confirm schedule, housing, meals, pay or exchange terms, minimum stay, and arrival contact before either side commits.",
      },
    ],
  };
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const target = {
    name: params.get("name") || "",
    location: params.get("location") || "",
  };
  const openings = await openingOptions();
  selectedOpening =
    openings.find((opening) => openingKey(opening) === openingKey(target)) ||
    openings.find((opening) => opening.name === target.name) ||
    fallbackOpenings[0];
  renderOpening(selectedOpening);
  await requireWorkerAccount();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentAccount || currentAccount.type !== "worker") {
    showApplicationGate();
    showToast("Create or log into a worker account before applying.");
    return;
  }
  const formData = new FormData(form);
  const thread = threadFromForm(formData);
  saveThreads([thread, ...storedThreads()]);
  showToast("Application saved. Opening communications...");
  window.setTimeout(() => {
    window.location.href = `./communications.html?thread=${encodeURIComponent(thread.id)}`;
  }, 500);
});

init();
