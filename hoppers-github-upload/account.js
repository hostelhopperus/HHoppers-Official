const authSection = document.querySelector("#account-auth");
const dashboard = document.querySelector("#account-dashboard");
const authTabButtons = document.querySelectorAll("[data-auth-tab]");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const profileForm = document.querySelector("#profile-form");
const findHostelsPanel = document.querySelector("#find-hostels-panel");
const openingFilters = document.querySelector("#opening-filters");
const accountOpeningGrid = document.querySelector("#account-opening-grid");
const savedOpeningList = document.querySelector("#saved-opening-list");
const workerProfilePage = document.querySelector("#worker-profile-page");
const workerAccountHome = document.querySelector("#worker-account-home");
const hostelAccountHome = document.querySelector("#hostel-account-home");
const hostelPhotosPanel = document.querySelector("#hostel-photos-panel");
const hostelPhotosForm = document.querySelector("#hostel-photos-form");
const logoutButton = document.querySelector("#account-logout");
const manageBillingButton = document.querySelector("#manage-billing");
const cancelMembershipButton = document.querySelector("#cancel-membership");
const toast = document.querySelector("#toast");

let currentAccount = null;
let currentOpenings = [];
let currentApplications = [];

const planLabels = {
  "worker-basic": "Worker Basic",
  "worker-premium": "Worker Premium",
  "hostel-basic": "Hostel Basic",
  "hostel-premium": "Hostel Premium",
  "hostel-partner": "Hostel Basic",
};

const paymentPages = {
  "worker-basic": "./payment-worker-basic.html",
  "worker-premium": "./payment-worker-premium.html",
  "hostel-basic": "./payment-hostel-basic.html",
  "hostel-premium": "./payment-hostel-premium.html",
  "hostel-partner": "./payment-hostel-basic.html",
};

function createClientReferenceId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `hoppers_${Date.now()}_${randomPart}`;
}

function accountNextUrl() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "";
  return next;
}

function continueToNext() {
  const next = accountNextUrl();
  if (!next) return false;
  window.location.href = next;
  return true;
}

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
  "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia",
  "Comoros", "Congo", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea",
  "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana",
  "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland",
  "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya",
  "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
  "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
  "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis",
  "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia",
  "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia",
  "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

const fallbackOpenings = [
  {
    id: "sample-reception-lisbon",
    name: "Reception Helper",
    role: "Reception Helper",
    hostelName: "Sample Lisbon Hostel",
    city: "Lisbon",
    country: "Portugal",
    location: "Lisbon, Portugal",
    roles: ["Reception", "Guest support"],
    startDate: "2026-07-01",
    endDate: "2026-08-31",
    minimumStay: "4-8 weeks",
    minimumStayWeeks: 4,
    window: "July 2026, 4-8 weeks",
    details: "20/week. Bed + breakfast. Work exchange.",
    startMonth: "July 2026",
    duration: "4-8 weeks",
    hours: "20/week",
    hoursPerWeek: "20/week",
    housing: "Bed included",
    housingIncluded: true,
    meals: "Breakfast included",
    mealsIncluded: true,
    type: "Work exchange",
    compensation: "Work exchange",
    languages: ["English"],
    status: "Pilot listing",
    sample: true,
    pilot: true,
  },
  {
    id: "sample-events-costa-rica",
    name: "Social Events Crew",
    role: "Social Events Crew",
    hostelName: "Sample Costa Rica Hostel",
    city: "Costa Rica",
    country: "Costa Rica",
    location: "Costa Rica",
    roles: ["Events", "Guest experience"],
    startDate: "2026-08-01",
    endDate: "2026-11-30",
    minimumStay: "1-3 months",
    minimumStayWeeks: 4,
    window: "August 2026, 1-3 months",
    details: "20-25/week. Dorm bed included. Work exchange.",
    startMonth: "August 2026",
    duration: "1-3 months",
    hours: "20-25/week",
    hoursPerWeek: "20-25/week",
    housing: "Dorm bed included",
    housingIncluded: true,
    meals: "Confirm with hostel",
    mealsIncluded: false,
    type: "Work exchange",
    compensation: "Work exchange",
    languages: ["English", "Spanish helpful"],
    status: "Pilot listing",
    sample: true,
    pilot: true,
  },
  {
    id: "sample-surf-ericeira",
    name: "Surf Hostel All-Rounder",
    role: "Surf Hostel All-Rounder",
    hostelName: "Sample Surf Hostel",
    city: "Ericeira",
    country: "Portugal",
    location: "Ericeira, Portugal",
    roles: ["Reception", "Cleaning", "Events"],
    startDate: "2026-06-01",
    endDate: "2026-08-31",
    minimumStay: "6-10 weeks",
    minimumStayWeeks: 6,
    window: "June 2026, 6-10 weeks",
    details: "25/week. Bed included. Paid + housing.",
    startMonth: "June 2026",
    duration: "6-10 weeks",
    hours: "25/week",
    hoursPerWeek: "25/week",
    housing: "Bed included",
    housingIncluded: true,
    meals: "Confirm with hostel",
    mealsIncluded: false,
    type: "Paid + housing",
    compensation: "Paid + housing",
    languages: ["English", "Portuguese helpful"],
    status: "Pilot listing",
    sample: true,
    pilot: true,
  },
  {
    id: "sample-night-amsterdam",
    name: "Night Reception",
    role: "Night Reception",
    hostelName: "Sample Amsterdam Hostel",
    city: "Amsterdam",
    country: "Netherlands",
    location: "Amsterdam, Netherlands",
    roles: ["Reception", "Night shift"],
    startDate: "2026-09-01",
    endDate: "2027-01-31",
    minimumStay: "2-4 months",
    minimumStayWeeks: 8,
    window: "September 2026, 2-4 months",
    details: "24/week. Staff room included. Paid.",
    startMonth: "September 2026",
    duration: "2-4 months",
    hours: "24/week",
    hoursPerWeek: "24/week",
    housing: "Staff room included",
    housingIncluded: true,
    meals: "Confirm with hostel",
    mealsIncluded: false,
    type: "Paid",
    compensation: "Paid",
    languages: ["English", "Dutch helpful"],
    status: "Pilot listing",
    sample: true,
    pilot: true,
  },
  {
    id: "sample-housekeeping-queenstown",
    name: "Housekeeping & Breakfast Support",
    role: "Housekeeping & Breakfast Support",
    hostelName: "Sample Queenstown Hostel",
    city: "Queenstown",
    country: "New Zealand",
    location: "Queenstown, New Zealand",
    roles: ["Housekeeping", "Breakfast", "Cleaning"],
    startDate: "2026-11-01",
    endDate: "2027-02-28",
    minimumStay: "2-3 months",
    minimumStayWeeks: 8,
    window: "November 2026, 2-3 months",
    details: "20/week. Bed + breakfast. Exchange.",
    startMonth: "November 2026",
    duration: "2-3 months",
    hours: "20/week",
    hoursPerWeek: "20/week",
    housing: "Bed included",
    housingIncluded: true,
    meals: "Breakfast included",
    mealsIncluded: true,
    type: "Exchange",
    compensation: "Exchange",
    languages: ["English"],
    status: "Pilot listing",
    sample: true,
    pilot: true,
  },
  {
    id: "sample-bar-budapest",
    name: "Bar / Events Assistant",
    role: "Bar / Events Assistant",
    hostelName: "Sample Budapest Hostel",
    city: "Budapest",
    country: "Hungary",
    location: "Budapest, Hungary",
    roles: ["Bar", "Events"],
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    minimumStay: "1-2 months",
    minimumStayWeeks: 4,
    window: "July 2026, 1-2 months",
    details: "20/week. Dorm bed included. Paid trial / exchange.",
    startMonth: "July 2026",
    duration: "1-2 months",
    hours: "20/week",
    hoursPerWeek: "20/week",
    housing: "Dorm bed included",
    housingIncluded: true,
    meals: "Confirm with hostel",
    mealsIncluded: false,
    type: "Paid trial / exchange",
    compensation: "Paid trial / exchange",
    languages: ["English"],
    status: "Pilot listing",
    sample: true,
    pilot: true,
  },
];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function profileList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayList(value) {
  return profileList(value).join(", ");
}

function listBadges(value, fallback = "Not added yet") {
  const items = profileList(value);
  return items.length
    ? items.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")
    : `<span class="muted-inline">${escapeHtml(fallback)}</span>`;
}

function textBlock(value, fallback = "Not added yet.") {
  const text = String(value || "").trim();
  return text ? escapeHtml(text).replaceAll("\n", "<br />") : `<span class="muted-inline">${escapeHtml(fallback)}</span>`;
}

function safeExternalUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

async function fetchJson(url, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("Account saving needs the Hoppers server. Open the live site or localhost, not a file:// copy.");
  }
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

async function savePendingSignup(signup) {
  const response = await fetchJson("/api/account/pending-signup", {
    method: "POST",
    body: JSON.stringify(signup),
  });
  const pending = {
    ...signup,
    email: response.account?.email || signup.email,
    accountId: response.accountId || response.account?.id || "",
    clientReferenceId: response.clientReferenceId || signup.clientReferenceId,
    paymentPage: response.paymentPage || paymentPages[signup.plan] || "./sign-in.html",
  };
  sessionStorage.setItem("hoppersPendingAccount", JSON.stringify(pending));
  return pending;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function statusLabel(value) {
  return String(value || "profile_draft")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formProfile(form) {
  const formData = new FormData(form);
  const type = String(formData.get("type") || currentAccount?.type || "worker");
  let photos = [];
  try {
    photos = JSON.parse(String(formData.get("photosData") || "[]"));
  } catch {
    photos = [];
  }
  const profile = {
    name: String(formData.get("name") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    website: type === "hostel" ? String(formData.get("website") || "").trim() : "",
    nationality: type === "worker" ? String(formData.get("nationality") || "").trim() : "",
    photo: String(formData.get("photoData") || currentAccount?.profile?.photo || ""),
    photos: type === "hostel" ? photos.slice(0, 10) : [],
    tags: formData.getAll("tags"),
    startDate: String(formData.get("startDate") || ""),
    endDate: String(formData.get("endDate") || ""),
    plan: String(formData.get("plan") || ""),
    bio: String(formData.get("bio") || "").trim(),
    headline: type === "worker" ? String(formData.get("headline") || "").trim() : "",
    languages: type === "worker" ? String(formData.get("languages") || "").trim() : "",
    previousHostels: type === "worker" ? String(formData.get("previousHostels") || "").trim() : "",
    workCountries: type === "worker" ? String(formData.get("workCountries") || "").trim() : "",
    experience: type === "worker" ? String(formData.get("experience") || "").trim() : "",
    education: type === "worker" ? String(formData.get("education") || "").trim() : "",
    certifications: type === "worker" ? String(formData.get("certifications") || "").trim() : "",
    references: type === "worker" ? String(formData.get("references") || "").trim() : "",
    preferredRegions: type === "worker" ? String(formData.get("preferredRegions") || "").trim() : "",
    workStyle: type === "worker" ? String(formData.get("workStyle") || "").trim() : "",
    portfolio: type === "worker" ? String(formData.get("portfolio") || "").trim() : "",
    workEligibilityAcknowledged: type === "worker" ? Boolean(formData.get("workEligibilityAcknowledged")) : false,
  };
  return profile;
}

function populateNationalitySelects() {
  document.querySelectorAll("[data-nationality-select]").forEach((select) => {
    select.innerHTML = `<option value="">Select nationality</option>${countries
      .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
      .join("")}`;
  });
  document.querySelectorAll("[data-opening-country]").forEach((select) => {
    select.innerHTML = `<option value="">Any country</option>${countries
      .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
      .join("")}`;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Could not read image.")));
    reader.readAsDataURL(file);
  });
}

async function attachPhoto(form, profile) {
  const input = form.elements.photo;
  const file = input?.files?.[0];
  const galleryInput = form.elements.photos;
  const galleryFiles = [...(galleryInput?.files || [])];
  let nextProfile = profile;
  if (file) {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file for the profile photo.");
    if (file.size > 900 * 1024) throw new Error("Profile photo must be under 900 KB.");
    nextProfile = {
      ...nextProfile,
      photo: await fileToDataUrl(file),
    };
  }
  if (galleryFiles.length) {
    if (galleryFiles.length > 10) throw new Error("Choose up to 10 hostel photos.");
    galleryFiles.forEach((galleryFile) => {
      if (!galleryFile.type.startsWith("image/")) throw new Error("Hostel photos must be image files.");
      if (galleryFile.size > 900 * 1024) throw new Error("Each hostel photo must be under 900 KB.");
    });
    nextProfile = {
      ...nextProfile,
      photos: await Promise.all(galleryFiles.map(fileToDataUrl)),
    };
  }
  return nextProfile;
}

function validateGalleryFiles(files, existingCount = 0) {
  if (existingCount + files.length > 10) throw new Error("Hostel galleries can have up to 10 photos total.");
  files.forEach((galleryFile) => {
    if (!galleryFile.type.startsWith("image/")) throw new Error("Hostel photos must be image files.");
    if (galleryFile.size > 900 * 1024) throw new Error("Each hostel photo must be under 900 KB.");
  });
}

function checkedTags(form, tags = []) {
  form.querySelectorAll('input[name="tags"]').forEach((input) => {
    input.checked = tags.includes(input.value);
  });
}

function syncPlanOptions(type, select) {
  select.querySelectorAll('option[value^="hostel-"]').forEach((option) => {
    option.disabled = type !== "hostel";
  });
  select.querySelectorAll('option[value^="worker-"]').forEach((option) => {
    option.disabled = type === "hostel";
  });
  if (type === "hostel" && !select.value.startsWith("hostel-")) select.value = "hostel-basic";
  if (type === "worker" && !select.value.startsWith("worker-")) select.value = "worker-basic";
  select.closest("form")?.querySelectorAll(".worker-nationality-field").forEach((field) => {
    field.hidden = type === "hostel";
  });
  select.closest("form")?.querySelectorAll(".hostel-website-field").forEach((field) => {
    field.hidden = type !== "hostel";
  });
  select.closest("form")?.querySelectorAll(".hostel-photo-field").forEach((field) => {
    field.hidden = type !== "hostel";
  });
  select.closest("form")?.querySelectorAll(".worker-depth-field").forEach((field) => {
    field.hidden = type === "hostel";
  });
}

function fillProfileForm(account) {
  const profile = account.profile || {};
  profileForm.elements.name.value = profile.name || "";
  profileForm.elements.location.value = profile.location || "";
  profileForm.elements.website.value = account.type === "hostel" ? profile.website || "" : "";
  profileForm.elements.nationality.value = account.type === "worker" ? profile.nationality || "" : "";
  profileForm.elements.startDate.value = profile.startDate || "";
  profileForm.elements.endDate.value = profile.endDate || "";
  profileForm.elements.bio.value = profile.bio || "";
  profileForm.elements.headline.value = account.type === "worker" ? profile.headline || "" : "";
  profileForm.elements.languages.value = account.type === "worker" ? displayList(profile.languages) : "";
  profileForm.elements.previousHostels.value = account.type === "worker" ? displayList(profile.previousHostels) : "";
  profileForm.elements.workCountries.value = account.type === "worker" ? displayList(profile.workCountries) : "";
  profileForm.elements.experience.value = account.type === "worker" ? profile.experience || "" : "";
  profileForm.elements.education.value = account.type === "worker" ? profile.education || "" : "";
  profileForm.elements.certifications.value = account.type === "worker" ? displayList(profile.certifications) : "";
  profileForm.elements.references.value = account.type === "worker" ? profile.references || "" : "";
  profileForm.elements.preferredRegions.value = account.type === "worker" ? displayList(profile.preferredRegions) : "";
  profileForm.elements.workStyle.value = account.type === "worker" ? profile.workStyle || "" : "";
  profileForm.elements.portfolio.value = account.type === "worker" ? profile.portfolio || "" : "";
  if (profileForm.elements.workEligibilityAcknowledged) {
    profileForm.elements.workEligibilityAcknowledged.checked = account.type === "worker" && Boolean(profile.workEligibilityAcknowledged);
  }
  profileForm.elements.photoData.value = profile.photo || "";
  profileForm.elements.photosData.value = JSON.stringify(Array.isArray(profile.photos) ? profile.photos.slice(0, 10) : []);
  syncPlanOptions(account.type, profileForm.elements.plan);
  profileForm.elements.plan.value = profile.plan || (account.type === "hostel" ? "hostel-basic" : "worker-basic");
  checkedTags(profileForm, profile.tags || []);
  document.querySelector("#tags-legend").textContent = account.type === "hostel" ? "Roles needed" : "Skills";
}

function renderAvatar(profile) {
  const avatar = document.querySelector("#account-avatar");
  avatar.innerHTML = "";
  if (profile.photo) {
    const image = document.createElement("img");
    image.src = profile.photo;
    image.alt = "";
    avatar.append(image);
    return;
  }
  avatar.textContent = (profile.name || "H").trim().slice(0, 1).toUpperCase();
}

function profileCompletionDetails(profile = {}) {
  const checks = [
    ["Profile photo", Boolean(profile.photo)],
    ["Availability dates", Boolean(profile.startDate || profile.endDate)],
    ["Preferred countries", profileList(profile.preferredRegions).length > 0],
    ["Role interests", profileList(profile.tags).length > 0],
    ["Languages", profileList(profile.languages).length > 0],
    ["Hostel/hospitality experience", Boolean(profile.experience || profileList(profile.previousHostels).length)],
    ["Short bio", Boolean(profile.bio)],
    ["References", Boolean(profile.references)],
    ["Work eligibility acknowledgment", Boolean(profile.workEligibilityAcknowledged)],
  ];
  const completed = checks.filter(([, done]) => done).map(([label]) => label);
  const missing = checks.filter(([, done]) => !done).map(([label]) => label);
  return {
    percent: Math.round((completed.length / checks.length) * 100),
    completed,
    missing,
  };
}

function profileCompletion(profile) {
  return profileCompletionDetails(profile).percent;
}

function isAvailableNow(profile = {}) {
  if (!profile.startDate) return false;
  const parts = String(profile.startDate).split("-");
  if (parts.length !== 3) return false;
  const start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 14);
  return start >= today && start <= limit;
}

function verificationBadges(account) {
  const profile = account.profile || {};
  if (account.type === "hostel") {
    return [
      ["Verified hostel", account.status === "approved" || account.status === "active" || account.status === "paying"],
      ["Website verified", Boolean(safeExternalUrl(profile.website))],
      ["Role details confirmed", profileList(profile.tags).length > 0 && Boolean(profile.bio || profile.startDate)],
      ["Housing details confirmed", /housing|staff room|dorm|bed/i.test(`${profile.bio || ""} ${profile.staffHousingInfo || ""}`)],
      ["Pilot partner", ["pilot", "active", "paying", "approved"].includes(account.status)],
    ];
  }
  return [
    ["Email verified", Boolean(account.email)],
    ["Phone/WhatsApp verified", Boolean(profile.phone || profile.whatsapp)],
    ["Reference added", Boolean(profile.references)],
    ["Hostel experience", Boolean(profile.experience || profileList(profile.previousHostels).length)],
    ["Available now", isAvailableNow(profile)],
    ["Interviewed by Hoppers", Boolean(profile.verification?.interviewedByHoppers)],
  ];
}

function badgeRow(items) {
  return items
    .map(
      ([label, active]) =>
        `<span class="verification-badge ${active ? "is-active" : "is-muted"}">${active ? "✓" : "+"} ${escapeHtml(label)}</span>`
    )
    .join("");
}

function renderProfileStrength(account) {
  const target = document.querySelector("#worker-profile-strength");
  if (!target || account.type !== "worker") return;
  const details = profileCompletionDetails(account.profile || {});
  const nextPrompt = details.missing.slice(0, 3).join(", ") || "Keep your profile fresh when your dates change.";
  target.innerHTML = `
    <article class="profile-strength-card">
      <div>
        <p class="eyebrow">Profile strength</p>
        <h3>${details.percent}% complete</h3>
        <p>Add your availability and experience to get more hostel views.</p>
      </div>
      <div class="profile-strength-meter" aria-label="Profile completion ${details.percent}%">
        <span style="width: ${details.percent}%"></span>
      </div>
      <p class="profile-strength-next"><strong>Next:</strong> ${escapeHtml(nextPrompt)}</p>
    </article>
  `;
}

function workerAvatarMarkup(profile) {
  return profile.photo
    ? `<img src="${escapeHtml(profile.photo)}" alt="" />`
    : `<span>${escapeHtml((profile.name || "H").trim().slice(0, 1).toUpperCase())}</span>`;
}

function previousHostelCards(profile) {
  const hostels = profileList(profile.previousHostels);
  return hostels.length
    ? hostels
        .map(
          (hostel) => `
            <article>
              <strong>${escapeHtml(hostel)}</strong>
              <p>Past hostel, volunteer exchange, seasonal role, or hospitality reference.</p>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">Add hostels or hospitality roles you have worked before.</p>`;
}

function renderWorkerProfile(account) {
  if (!workerProfilePage) return;
  const profile = account.profile || {};
  const completion = profileCompletion(profile);
  const portfolio = safeExternalUrl(profile.portfolio);
  const badges = badgeRow(verificationBadges(account));
  document.querySelector("#worker-profile-view").innerHTML = `
    <article class="worker-profile-hero">
      <div class="worker-cover"></div>
      <div class="worker-identity-row">
        <div class="worker-profile-avatar">${workerAvatarMarkup(profile)}</div>
        <div class="worker-identity-copy">
          <p class="eyebrow">View profile</p>
          <h2>${escapeHtml(profile.name || "Worker profile")}</h2>
          <p class="worker-headline">${escapeHtml(profile.headline || "Add a short headline that tells hostels what you are great at.")}</p>
          <div class="worker-profile-meta">
            <span>${escapeHtml(profile.location || "Location open")}</span>
            <span>${escapeHtml(profile.nationality || "Nationality not added")}</span>
            <span>${escapeHtml(account.billing?.planLabel || planLabels[profile.plan] || "Plan pending")}</span>
          </div>
          <div class="verification-badge-row">${badges}</div>
        </div>
        <div class="worker-profile-actions">
          <a class="button button-dark" href="#profile-form">Edit profile</a>
          <a class="button button-light" href="#profile-form">Change photo</a>
        </div>
      </div>
    </article>

    <div class="worker-profile-grid">
      <section class="worker-profile-card about-card">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">About</p>
            <h3>Worker summary</h3>
          </div>
          <span class="badge">${completion}% complete</span>
        </div>
        <p>${textBlock(profile.bio, "Write a little about who you are, how you work, and what kind of hostel stay fits you.")}</p>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Previously worked at</p>
        <h3>Hostel and hospitality history</h3>
        <div class="previous-hostel-list">${previousHostelCards(profile)}</div>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Experience</p>
        <h3>Relevant work</h3>
        <p>${textBlock(profile.experience, "Add reception, housekeeping, bar, cafe, events, tours, social media, maintenance, or guest support experience.")}</p>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Work style</p>
        <h3>How you show up</h3>
        <p>${textBlock(profile.workStyle, "Add how you handle guests, managers, shared housing, busy shifts, and early or late schedules.")}</p>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Skills</p>
        <h3>Roles you can cover</h3>
        <div class="tag-list">${listBadges(profile.tags, "Choose skills in the edit profile form.")}</div>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Languages</p>
        <h3>Guest communication</h3>
        <div class="tag-list">${listBadges(profile.languages, "Add languages you speak.")}</div>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Availability</p>
        <h3>Dates and regions</h3>
        <dl class="brief-list compact">
          <div>
            <dt>Dates</dt>
            <dd>${escapeHtml(dateRange(profile.startDate, profile.endDate))}</dd>
          </div>
          <div>
            <dt>Preferred regions</dt>
            <dd>${profileList(profile.preferredRegions).length ? escapeHtml(displayList(profile.preferredRegions)) : "Open to the right fit"}</dd>
          </div>
          <div>
            <dt>Can legally work in</dt>
            <dd>${profileList(profile.workCountries).length ? escapeHtml(displayList(profile.workCountries)) : "Not added yet"}</dd>
          </div>
        </dl>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Credentials</p>
        <h3>Education, certificates, references</h3>
        <dl class="brief-list compact">
          <div>
            <dt>Education</dt>
            <dd>${textBlock(profile.education)}</dd>
          </div>
          <div>
            <dt>Certificates</dt>
            <dd>${profileList(profile.certifications).length ? escapeHtml(displayList(profile.certifications)) : "Not added yet"}</dd>
          </div>
          <div>
            <dt>References</dt>
            <dd>${textBlock(profile.references, "Available on request, or add reference details here.")}</dd>
          </div>
        </dl>
      </section>

      <section class="worker-profile-card">
        <p class="eyebrow">Links</p>
        <h3>Portfolio or social profile</h3>
        ${
          portfolio
            ? `<a class="text-link" href="${escapeHtml(portfolio)}" target="_blank" rel="noreferrer">${escapeHtml(portfolio)}</a>`
            : `<p><span class="muted-inline">Add a portfolio, video intro, or relevant social profile.</span></p>`
        }
      </section>
    </div>
  `;

  document.querySelector("#worker-language-view").innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Language</p>
        <h2>Languages and guest comfort</h2>
      </div>
      <a class="button button-light" href="#profile-form">Edit languages</a>
    </div>
    <div class="language-grid">
      <article>
        <h3>Languages listed</h3>
        <div class="tag-list">${listBadges(profile.languages, "No languages added yet.")}</div>
      </article>
      <article>
        <h3>Where this helps</h3>
        <p>Languages show hostels where you can help with reception, check-ins, events, tours, signs, guest questions, and late-night problem solving.</p>
      </article>
    </div>
  `;
}

function renderHostelGallery(account) {
  const gallery = document.querySelector("#hostel-photo-gallery");
  const editorGallery = document.querySelector("#hostel-photo-editor-gallery");
  const count = document.querySelector("#hostel-photo-count");
  if (!gallery) return;
  const photos = Array.isArray(account.profile?.photos) ? account.profile.photos.slice(0, 10) : [];
  if (hostelPhotosPanel) hostelPhotosPanel.hidden = account.type !== "hostel";
  if (count) count.textContent = `${photos.length} / 10 photos`;
  gallery.hidden = account.type !== "hostel";
  gallery.innerHTML = photos.length
    ? `<p class="eyebrow">Hostel photos</p><div>${photos
        .map((photo) => `<img src="${escapeHtml(photo)}" alt="" />`)
        .join("")}</div>`
    : `<p class="eyebrow">Hostel photos</p><p class="empty-state">Add up to 10 photos in the Edit hostel photo gallery section.</p>`;
  if (editorGallery) {
    editorGallery.innerHTML = photos.length
      ? photos.map((photo) => `<img src="${escapeHtml(photo)}" alt="" />`).join("")
      : `<p class="empty-state">No hostel photos yet. Add photos above and save them.</p>`;
  }
}

function renderApplications(applications = []) {
  const list = document.querySelector("#application-list");
  list.innerHTML = applications.length
    ? applications
        .map(
          (application) => `
            <article>
              <div>
                <strong>${escapeHtml(application.opening?.role || application.opening?.title || application.opening?.hostelName || "Hoppers application")}</strong>
                <p>${escapeHtml(application.opening?.hostelName || application.planLabel || "Hoppers review")} · ${escapeHtml(application.opening?.location || "Location pending")}</p>
              </div>
              <span class="status-pill status-${escapeHtml(application.status)}">${escapeHtml(statusLabel(application.status))}</span>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">No applications are attached to this email yet.</p>`;
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

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateRange(startDate, endDate) {
  const start = formatDateOnly(startDate);
  const end = formatDateOnly(endDate);
  if (start && end) return `${start} - ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return "Dates flexible";
}

function openingCountry(opening) {
  if (opening.country) return opening.country;
  const parts = String(opening.location || "").split(",");
  return (parts[parts.length - 1] || "").trim();
}

function submissionToOpening(submission) {
  const data = submission.data || {};
  const location = data.location || "Location pending";
  const parts = String(location)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    id: submission.id,
    source: submission.source || "submission",
    hostelAccountId: submission.source === "account" ? submission.id : "",
    hostelEmail: data.email || "",
    name: data.role || valuesList(data.roles || data.role)[0] || "Hostel role",
    role: data.role || valuesList(data.roles || data.role)[0] || "Hostel role",
    hostelName: data.name || "Approved hostel",
    location,
    city: data.city || (parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0] || ""),
    country: data.country || (parts.length > 1 ? parts.at(-1) : ""),
    roles: valuesList(data.roles || data.role),
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    window: dateRange(data.startDate, data.endDate),
    minimumStay: data.minimumStay || data.duration || dateRange(data.startDate, data.endDate),
    minimumStayWeeks: Number(data.minimumStayWeeks || 0),
    startMonth: data.startMonth || formatDateOnly(data.startDate) || "Flexible",
    duration: data.duration || data.minimumStay || "Flexible",
    hours: data.hoursPerWeek || data.hours || "Confirm with hostel",
    hoursPerWeek: data.hoursPerWeek || data.hours || "Confirm with hostel",
    housing: data.housingIncluded ? "Yes" : "Confirm with hostel",
    housingIncluded: Boolean(data.housingIncluded),
    meals: data.mealsIncluded ? "Yes" : "Confirm with hostel",
    mealsIncluded: Boolean(data.mealsIncluded),
    type: data.compensation || data.type || "Confirm with hostel",
    compensation: data.compensation || data.type || "Confirm with hostel",
    languages: valuesList(data.languages || data.languageRequirements, "Confirm with hostel"),
    details: data.description || "Details available after approval",
    status: data.pilot ? "Pilot listing" : "Approved",
    pilot: Boolean(data.pilot),
    sample: false,
  };
}

function tagList(items) {
  return items.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("");
}

function openingMatchesDates(opening, startDate, endDate) {
  if (!startDate && !endDate) return true;
  if (!opening.startDate && !opening.endDate) return true;
  const openingStart = opening.startDate || "0000-01-01";
  const openingEnd = opening.endDate || "9999-12-31";
  const workerStart = startDate || "0000-01-01";
  const workerEnd = endDate || "9999-12-31";
  return openingStart <= workerEnd && workerStart <= openingEnd;
}

function renderOpeningCard(opening) {
  const id = openingId(opening);
  const saved = savedOpeningIds().includes(id);
  return `
    <article class="account-opening-card">
      <div class="profile-top">
        <div>
          <h3>${escapeHtml(opening.role || opening.name)}</h3>
          <p class="location">+ ${escapeHtml(opening.hostelName || "Hostel")} · ${escapeHtml(opening.location)}</p>
        </div>
        <span class="badge">${escapeHtml(opening.pilot || opening.sample ? "Pilot listing" : opening.status || "Approved")}</span>
      </div>
      <div class="profile-meta listing-meta-grid">
        <div><span class="label">Start</span><p>${escapeHtml(opening.startMonth || formatDateOnly(opening.startDate) || "Flexible")}</p></div>
        <div><span class="label">Minimum stay</span><p>${escapeHtml(opening.minimumStay || opening.duration || opening.window || "Flexible")}</p></div>
        <div><span class="label">Hours/week</span><p>${escapeHtml(opening.hoursPerWeek || opening.hours || "Confirm with hostel")}</p></div>
        <div><span class="label">Housing</span><p>${escapeHtml(opening.housingIncluded ? "Yes" : opening.housing || "Confirm with hostel")}</p></div>
        <div><span class="label">Meals</span><p>${escapeHtml(opening.mealsIncluded ? "Yes" : opening.meals || "Confirm with hostel")}</p></div>
        <div><span class="label">Type</span><p>${escapeHtml(opening.compensation || opening.type || "Confirm with hostel")}</p></div>
        <div><span class="label">Languages</span><p>${escapeHtml(displayList(opening.languages) || "Confirm with hostel")}</p></div>
        <div><span class="label">Roles</span><div class="tag-list">${tagList(opening.roles)}</div></div>
      </div>
      <button class="button button-light save-opening" type="button" data-opening-id="${escapeHtml(id)}">
        ${saved ? "Saved" : "Save opening"}
      </button>
      <a class="button button-dark" href="./opening-apply.html?name=${encodeURIComponent(opening.name)}&location=${encodeURIComponent(opening.location)}">Apply</a>
    </article>
  `;
}

function openingId(opening) {
  return opening.id || `${opening.name}|${opening.location}|${opening.window}`;
}

function savedOpeningKey() {
  return `hoppers_saved_openings_${currentAccount?.id || currentAccount?.email || "guest"}`;
}

function savedOpeningIds() {
  try {
    return JSON.parse(localStorage.getItem(savedOpeningKey()) || "[]");
  } catch {
    return [];
  }
}

function setSavedOpeningIds(ids) {
  localStorage.setItem(savedOpeningKey(), JSON.stringify(ids));
}

function renderSavedOpenings() {
  if (!savedOpeningList) return;
  const ids = savedOpeningIds();
  const saved = currentOpenings.filter((opening) => ids.includes(openingId(opening)));
  savedOpeningList.innerHTML = saved.length
    ? saved
        .map(
          (opening) => `
            <article>
              <div>
                <strong>${escapeHtml(opening.name)}</strong>
                <p>${escapeHtml(opening.location)} · ${escapeHtml(opening.window)}</p>
              </div>
              <button class="text-button unsave-opening" type="button" data-opening-id="${escapeHtml(openingId(opening))}">Remove</button>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">Saved openings will appear here.</p>`;
}

function applyOpeningFilters(openings) {
  const formData = new FormData(openingFilters);
  const roles = formData.getAll("roles").map((role) => String(role).toLowerCase());
  const country = String(formData.get("country") || "");
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const housingIncluded = Boolean(formData.get("housingIncluded"));
  const type = String(formData.get("type") || "").toLowerCase();
  const minimumStayWeeks = Number(formData.get("minimumStayWeeks") || 0);
  return openings.filter((opening) => {
    const roleMatches =
      !roles.length ||
      roles.some((role) => opening.roles.some((item) => item.toLowerCase() === role || item.toLowerCase().includes(role)));
    const countryMatches = !country || openingCountry(opening) === country;
    const housingMatches = !housingIncluded || Boolean(opening.housingIncluded);
    const typeText = String(opening.compensation || opening.type || "").toLowerCase();
    const typeMatches = !type || typeText.includes(type);
    const stayMatches = !minimumStayWeeks || !opening.minimumStayWeeks || Number(opening.minimumStayWeeks) <= minimumStayWeeks;
    return roleMatches && countryMatches && housingMatches && typeMatches && stayMatches && openingMatchesDates(opening, startDate, endDate);
  });
}

async function renderFindHostels() {
  if (!accountOpeningGrid || !openingFilters) return;
  accountOpeningGrid.innerHTML = `<p class="empty-state">Loading hostel openings...</p>`;
  try {
    const { hostels } = await fetchJson("/api/published/hostels");
    const savedOpenings = hostels.map(submissionToOpening);
    const openings = savedOpenings.length ? savedOpenings : fallbackOpenings;
    currentOpenings = openings;
    const renderFiltered = () => {
      const filtered = applyOpeningFilters(openings);
      accountOpeningGrid.innerHTML = filtered.length
        ? filtered.map(renderOpeningCard).join("")
        : `<p class="empty-state">No openings match those filters yet.</p>`;
      renderSavedOpenings();
    };
    openingFilters.oninput = renderFiltered;
    openingFilters.onchange = renderFiltered;
    renderFiltered();
  } catch {
    currentOpenings = fallbackOpenings;
    accountOpeningGrid.innerHTML = fallbackOpenings.map(renderOpeningCard).join("");
    renderSavedOpenings();
  }
}

accountOpeningGrid?.addEventListener("click", (event) => {
  const button = event.target.closest(".save-opening");
  if (!button) return;
  const ids = savedOpeningIds();
  const next = ids.includes(button.dataset.openingId)
    ? ids.filter((id) => id !== button.dataset.openingId)
    : [...ids, button.dataset.openingId];
  setSavedOpeningIds(next);
  renderFindHostels();
});

savedOpeningList?.addEventListener("click", (event) => {
  const button = event.target.closest(".unsave-opening");
  if (!button) return;
  setSavedOpeningIds(savedOpeningIds().filter((id) => id !== button.dataset.openingId));
  renderFindHostels();
});

document.addEventListener("change", (event) => {
  if (!event.target.matches(".hostel-photo-input")) return;
  const count = event.target.files?.length || 0;
  const button = event.target.closest(".hostel-photo-field")?.querySelector(".photo-picker-button");
  if (button) button.textContent = count ? `${count} photo${count === 1 ? "" : "s"} selected` : "Choose up to 10 photos";
});

hostelPhotosForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentAccount || currentAccount.type !== "hostel") return;
  const input = hostelPhotosForm.elements.hostelPhotos;
  const files = [...(input?.files || [])];
  const existing = Array.isArray(currentAccount.profile?.photos) ? currentAccount.profile.photos.slice(0, 10) : [];
  if (!files.length) {
    showToast("Choose one or more hostel photos first.");
    return;
  }
  const button = hostelPhotosForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    validateGalleryFiles(files, existing.length);
    const addedPhotos = await Promise.all(files.map(fileToDataUrl));
    const profile = {
      ...(currentAccount.profile || {}),
      photos: [...existing, ...addedPhotos].slice(0, 10),
    };
    const payload = await fetchJson("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ profile }),
    });
    input.value = "";
    showDashboard(payload);
    showToast("Hostel photos saved.");
  } catch (error) {
    showToast(error.message || "Could not save hostel photos.");
  } finally {
    button.disabled = false;
  }
});

function communicationThreads() {
  try {
    return JSON.parse(localStorage.getItem("hoppers_communications") || "[]");
  } catch {
    return [];
  }
}

function clearLocalDeletedAccountData(account) {
  const email = String(account?.email || "").toLowerCase();
  const accountId = String(account?.id || "");
  const profileName = String(account?.profile?.name || "").toLowerCase();
  try {
    sessionStorage.removeItem("hoppersPendingAccount");
    localStorage.removeItem("hoppersPendingAccount");
    if (accountId) localStorage.removeItem(`hoppers_saved_openings_${accountId}`);
    if (email) localStorage.removeItem(`hoppers_saved_openings_${email}`);
    const nextThreads = communicationThreads().filter((thread) => {
      const workerEmail = String(thread.worker?.email || "").toLowerCase();
      const workerId = String(thread.worker?.accountId || "");
      const openingName = String(thread.opening?.name || "").toLowerCase();
      if (account?.type === "worker") return workerEmail !== email && workerId !== accountId;
      if (account?.type === "hostel") return !profileName || openingName !== profileName;
      return true;
    });
    localStorage.setItem("hoppers_communications", JSON.stringify(nextThreads));
  } catch {
    // Browser storage cleanup is best-effort after the server deletion succeeds.
  }
}

function workerThreads(account) {
  const email = String(account.email || "").toLowerCase();
  return communicationThreads().filter((thread) => String(thread.worker?.email || "").toLowerCase() === email);
}

function hostelThreads() {
  return communicationThreads();
}

function threadHref(thread) {
  return `./communications.html?thread=${encodeURIComponent(thread.id)}`;
}

function threadStatus(thread) {
  return thread.status || "Application sent";
}

function messageRole(message) {
  if (message.role === "worker" || message.role === "hostel" || message.role === "system") return message.role;
  const sender = String(message.sender || "").toLowerCase();
  if (sender.includes("worker")) return "worker";
  if (sender.includes("hostel")) return "hostel";
  return "system";
}

function hasNewMessage(thread, accountType) {
  const last = (thread.messages || []).at(-1);
  if (!last) return false;
  const role = messageRole(last);
  if (role === "system") return false;
  return accountType === "hostel" ? role === "worker" : role === "hostel";
}

function newMessageBadge(thread, accountType) {
  return hasNewMessage(thread, accountType) ? `<span class="new-message-badge">New message</span>` : "";
}

function accountThreadStatus(thread, accountType) {
  return hasNewMessage(thread, accountType) ? "New message" : threadStatus(thread);
}

function threadMessages(thread) {
  return (thread.messages || [])
    .map(
      (message) => {
        const sender = String(message.sender || "").toLowerCase();
        const side =
          message.role === "worker" || message.role === "hostel" || message.role === "system"
            ? message.role
            : sender.includes("worker")
              ? "worker"
              : sender.includes("hostel")
                ? "hostel"
                : "system";
        const label =
          side === "worker"
            ? !message.sender || message.sender === "You" || message.sender === "Worker" || sender.includes("worker")
              ? thread.worker?.name || "Worker"
              : message.sender
            : side === "hostel"
              ? !message.sender || message.sender === "Hostel" || sender.includes("hostel")
                ? thread.opening?.name || "Hostel"
                : message.sender
              : message.sender || "System";
        return `
        <article class="mini-message-card mini-message-${escapeHtml(side)}">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(formatDateTime(message.sentAt))}</span>
          </div>
          <p>${escapeHtml(message.body || "")}</p>
        </article>
      `;
      }
    )
    .join("");
}

function renderWorkerLanding(account) {
  renderProfileStrength(account);
  const threads = workerThreads(account);
  const applicationList = document.querySelector("#worker-application-list");
  const threadList = document.querySelector("#worker-thread-list");
  const empty = `<p class="empty-state">Applications you submit from opening pages will appear here.</p>`;
  const applications = currentApplications.filter((application) => application.source !== "profile_submission");
  applicationList.innerHTML = applications.length
    ? applications
        .map(
          (application) => `
            <article>
              <div>
                <strong>${escapeHtml(application.opening?.role || application.opening?.title || "Hostel opening")}</strong>
                <p>${escapeHtml(application.opening?.hostelName || "Hostel")} · ${escapeHtml(application.opening?.location || "Location pending")}</p>
              </div>
              <span class="status-pill status-${escapeHtml(application.status)}">${escapeHtml(statusLabel(application.status))}</span>
            </article>
          `
        )
        .join("")
    : empty;
  threadList.innerHTML = threads.length
    ? threads
        .map(
          (thread) => `
            <article class="${hasNewMessage(thread, "worker") ? "has-new-message" : ""}">
              <div>
                <strong>${escapeHtml(accountThreadStatus(thread, "worker"))}</strong>
                <p>${escapeHtml((thread.messages || []).at(-1)?.body || "No messages yet.")}</p>
              </div>
              <a class="text-button" href="${escapeHtml(threadHref(thread))}">Open</a>
            </article>
          `
        )
        .join("")
    : `<p class="empty-state">Open communication threads will appear after you apply.</p>`;
}

function renderHostelLanding(account) {
  const list = document.querySelector("#hostel-application-review-list");
  const badgeTarget = document.querySelector("#hostel-verification-badges");
  if (badgeTarget) badgeTarget.innerHTML = badgeRow(verificationBadges(account));
  const applications = currentApplications.filter((application) => application.source !== "profile_submission");
  const threads = hostelThreads(account);
  list.innerHTML = applications.length
    ? applications
        .map(
          (application) => `
            <article class="hostel-review-card">
              <div>
                <div class="profile-top">
                  <div>
                    <h3>${escapeHtml(application.worker?.name || "Unnamed worker")}</h3>
                    <p class="location">+ ${escapeHtml(application.opening?.role || "Hostel opening")} · ${escapeHtml(application.opening?.location || "Location pending")}</p>
                  </div>
                  <div class="status-stack">
                    <span class="status-pill status-${escapeHtml(application.status)}">${escapeHtml(statusLabel(application.status))}</span>
                  </div>
                </div>
                <dl class="brief-list compact">
                  <div>
                    <dt>Email</dt>
                    <dd>${escapeHtml(application.worker?.email || application.workerEmail || "No email")}</dd>
                  </div>
                  <div>
                    <dt>Available</dt>
                    <dd>${escapeHtml(dateRange(application.worker?.startDate, application.worker?.endDate))}</dd>
                  </div>
                  <div>
                    <dt>Roles</dt>
                    <dd>${escapeHtml(application.worker?.roles || "Roles not listed")}</dd>
                  </div>
                  <div>
                    <dt>Profile complete</dt>
                    <dd>${escapeHtml(application.worker?.profileCompleteness ?? "Not scored")}%</dd>
                  </div>
                  <div>
                    <dt>First message</dt>
                    <dd>${escapeHtml(application.message || "No message yet.")}</dd>
                  </div>
                </dl>
              </div>
              ${
                application.threadId
                  ? `<a class="button button-dark" href="./communications.html?thread=${encodeURIComponent(application.threadId)}">Review thread</a>`
                  : `<span class="badge">Application tracked</span>`
              }
            </article>
          `
        )
        .join("")
    : threads.length
      ? threads
        .map(
          (thread) => `
            <article class="hostel-review-card ${hasNewMessage(thread, "hostel") ? "has-new-message" : ""}">
              <div>
                <div class="profile-top">
                  <div>
                    <h3>${escapeHtml(thread.worker?.name || "Unnamed worker")}</h3>
                    <p class="location">+ ${escapeHtml(thread.opening?.name || "Hostel opening")} · ${escapeHtml(thread.opening?.location || "Location pending")}</p>
                  </div>
                  <div class="status-stack">
                    <span class="status-pill status-pending">${escapeHtml(accountThreadStatus(thread, "hostel"))}</span>
                  </div>
                </div>
                <dl class="brief-list compact">
                  <div>
                    <dt>Email</dt>
                    <dd>${escapeHtml(thread.worker?.email || "No email")}</dd>
                  </div>
                  <div>
                    <dt>Available</dt>
                    <dd>${escapeHtml(dateRange(thread.worker?.startDate, thread.worker?.endDate))}</dd>
                  </div>
                  <div>
                    <dt>Roles</dt>
                    <dd>${escapeHtml(thread.worker?.roles || "Roles not listed")}</dd>
                  </div>
                  <div>
                    <dt>First message</dt>
                    <dd>${escapeHtml((thread.messages || [])[0]?.body || "No message yet.")}</dd>
                  </div>
                </dl>
                <details class="application-wraparound">
                  <summary>Messages and wraparound</summary>
                  <div class="wraparound-grid">
                    <article>
                      <h4>Conversation</h4>
                      <div class="mini-message-list">${threadMessages(thread)}</div>
                    </article>
                    <article>
                      <h4>Review checklist</h4>
                      <ul>
                        <li>Confirm role, weekly hours, days off, and start date.</li>
                        <li>Confirm housing, meals, deposits, pay, or exchange terms.</li>
                        <li>Check the worker's dates, skills, and questions before accepting.</li>
                        <li>Use the full thread for follow-ups and final arrival details.</li>
                      </ul>
                    </article>
                  </div>
                </details>
              </div>
              <a class="button button-dark" href="${escapeHtml(threadHref(thread))}">Review thread</a>
            </article>
          `
        )
        .join("")
      : `<p class="empty-state">Worker applications for this hostel will appear here after they apply to an opening.</p>`;
}

function renderAccountLanding(account) {
  const isHostel = account.type === "hostel";
  if (workerProfilePage) workerProfilePage.hidden = isHostel;
  workerAccountHome.hidden = isHostel;
  hostelAccountHome.hidden = !isHostel;
  if (isHostel) renderHostelLanding(account);
  else {
    renderWorkerProfile(account);
    renderWorkerLanding(account);
  }
}

function billingLabel(value) {
  if (value === "paid") return "Active";
  if (value === "canceling") return "Canceling";
  if (value === "canceled") return "Canceled";
  if (value === "deleted") return "Deleted";
  return statusLabel(value || "not_connected");
}

function renderMembership(account) {
  const billing = account.billing || {};
  const status = billing.status || "not_connected";
  const hasCustomer = Boolean(billing.stripeCustomerId);
  const hasSubscription = Boolean(billing.stripeSubscriptionId);
  const statusPill = document.querySelector("#membership-status");
  const statusClass =
    status === "paid" ? "status-approved" : status === "canceling" ? "status-pending" : status === "canceled" ? "status-rejected" : "status-pending";
  statusPill.className = `status-pill ${statusClass}`;
  statusPill.textContent = billingLabel(status);
  document.querySelector("#membership-plan").textContent = billing.planLabel || planLabels[account.profile?.plan] || "Plan pending";
  document.querySelector("#membership-subscription").textContent = hasSubscription
    ? billing.subscriptionStatus || "Connected"
    : hasCustomer
      ? "Stripe customer connected; subscription lookup available"
      : "Not connected yet";
  document.querySelector("#membership-renewal").textContent = billing.currentPeriodEnd
    ? `${status === "canceling" ? "Ends" : "Renews"} ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
    : "Not available yet";
  document.querySelector("#membership-note").textContent =
    status === "canceling"
      ? "Your Hoppers account is closed and your Stripe subscription is scheduled to cancel at the end of the paid period."
      : status === "canceled"
        ? "This Hoppers account is closed. Automatic recurring payments should be stopped in Stripe."
        : "Deleting your account removes your Hoppers profile data and sends the cancellation to Stripe first so future recurring payments stop.";
  if (manageBillingButton) {
    manageBillingButton.disabled = !hasCustomer;
    manageBillingButton.title = hasCustomer ? "" : "Stripe customer details are not connected yet.";
  }
  if (cancelMembershipButton) {
    cancelMembershipButton.textContent = "Delete account";
    cancelMembershipButton.disabled = status === "canceling" || status === "canceled";
    cancelMembershipButton.title = hasSubscription
      ? ""
      : hasCustomer
        ? "Hoppers will ask Stripe for the active subscription tied to this customer."
        : "No Stripe subscription is connected. Hoppers will still delete the account profile data.";
  }
}

function showDashboard(payload) {
  currentAccount = payload.account;
  currentApplications = payload.applications || [];
  const account = payload.account;
  const profile = account.profile || {};
  authSection.hidden = true;
  dashboard.hidden = false;

  document.querySelector("#account-title").textContent = profile.name || "Your account";
  document.querySelector("#account-subtitle").textContent =
    account.type === "hostel" ? "Manage your hostel profile and partner settings." : "Manage your worker profile and placement settings.";
  renderAvatar(profile);
  renderHostelGallery(account);
  document.querySelector("#account-name").textContent = profile.name || "Profile name";
  document.querySelector("#account-email").textContent = account.email;
  document.querySelector("#account-status").textContent = statusLabel(account.status);
  document.querySelector("#account-type").textContent = account.type === "hostel" ? "Hostel" : "Worker";
  document.querySelector("#account-plan").textContent = account.billing?.planLabel || planLabels[profile.plan] || "Plan pending";
  document.querySelector("#account-billing").textContent = statusLabel(account.billing?.status || "billing_setup_after_approval");
  document.querySelector("#profile-updated").textContent = `Updated ${new Date(account.updatedAt).toLocaleDateString()}`;

  fillProfileForm(account);
  renderAccountLanding(account);
  renderMembership(account);
  renderApplications(payload.applications || []);
  findHostelsPanel.hidden = account.type === "hostel";
  if (account.type === "worker") renderFindHostels();
}

function showAuth() {
  currentAccount = null;
  dashboard.hidden = true;
  authSection.hidden = false;
}

function validateDates(profile) {
  if (profile.startDate && profile.endDate && profile.endDate < profile.startDate) {
    throw new Error("End date must be after the start date.");
  }
}

authTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    authTabButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    loginForm.hidden = button.dataset.authTab !== "login";
    registerForm.hidden = button.dataset.authTab !== "register";
  });
});

registerForm.elements.type.addEventListener("change", () => {
  syncPlanOptions(registerForm.elements.type.value, registerForm.elements.plan);
});

workerProfilePage?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-worker-panel]");
  if (!button) return;
  workerProfilePage.querySelectorAll("[data-worker-panel]").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  workerProfilePage.querySelectorAll("[data-worker-section]").forEach((section) => {
    section.hidden = section.dataset.workerSection !== button.dataset.workerPanel;
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const payload = await fetchJson("/api/account/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    showDashboard(payload);
    showToast("Account opened.");
    continueToNext();
  } catch (error) {
    showToast(error.message || "Could not log in.");
  } finally {
    button.disabled = false;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);
  let profile = formProfile(registerForm);
  const button = registerForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    profile = await attachPhoto(registerForm, profile);
    validateDates(profile);
    const plan = profile.plan || (formData.get("type") === "hostel" ? "hostel-basic" : "worker-basic");
    const pending = await savePendingSignup({
      type: formData.get("type"),
      email: String(formData.get("email") || "").trim(),
      password: formData.get("password"),
      profile,
      plan,
      clientReferenceId: createClientReferenceId(),
      startedAt: new Date().toISOString(),
    });
    showToast("Opening secure payment...");
    window.setTimeout(() => {
      window.location.href = pending.paymentPage || paymentPages[plan] || "./sign-in.html";
    }, 350);
  } catch (error) {
    showToast(error.message || "Could not prepare payment.");
  } finally {
    button.disabled = false;
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  let profile = formProfile(profileForm);
  const button = profileForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    profile = await attachPhoto(profileForm, profile);
    validateDates(profile);
    const payload = await fetchJson("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ profile }),
    });
    showDashboard(payload);
    showToast("Profile saved.");
  } catch (error) {
    showToast(error.message || "Could not save profile.");
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await fetchJson("/api/account/logout", { method: "POST" }).catch(() => {});
  showAuth();
  showToast("Logged out.");
});

manageBillingButton?.addEventListener("click", async () => {
  manageBillingButton.disabled = true;
  try {
    const payload = await fetchJson("/api/account/billing-portal", { method: "POST" });
    window.location.href = payload.url;
  } catch (error) {
    showToast(error.message || "Could not open Stripe billing.");
  } finally {
    manageBillingButton.disabled = false;
  }
});

cancelMembershipButton?.addEventListener("click", async () => {
  if (!confirm("Permanently delete this Hoppers account, remove its profile data, and cancel future recurring Stripe payments? This cannot be undone.")) return;
  cancelMembershipButton.disabled = true;
  try {
    const deletingAccount = currentAccount;
    await fetchJson("/api/account/delete-account", {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });
    clearLocalDeletedAccountData(deletingAccount);
    showToast("Account data deleted and Stripe cancellation sent.");
    window.setTimeout(() => {
      window.location.href = "./sign-in.html?account=deleted";
    }, 700);
  } catch (error) {
    showToast(error.message || "Could not delete account.");
  } finally {
    cancelMembershipButton.disabled = false;
  }
});

populateNationalitySelects();
syncPlanOptions(registerForm.elements.type.value, registerForm.elements.plan);
fetchJson("/api/account/session")
  .then((payload) => {
    if (payload.authenticated) {
      if (!continueToNext()) showDashboard(payload);
    }
  })
  .catch(() => {});
