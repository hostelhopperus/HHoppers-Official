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
const workerAccountHome = document.querySelector("#worker-account-home");
const hostelAccountHome = document.querySelector("#hostel-account-home");
const hostelPhotosPanel = document.querySelector("#hostel-photos-panel");
const hostelPhotosForm = document.querySelector("#hostel-photos-form");
const logoutButton = document.querySelector("#account-logout");
const toast = document.querySelector("#toast");

let currentAccount = null;
let currentOpenings = [];

const planLabels = {
  "worker-basic": "Worker Basic",
  "worker-premium": "Worker Premium",
  "hostel-partner": "Hostel Partner",
};

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
    name: "Alpine Base Hostel",
    location: "Interlaken, Switzerland",
    roles: ["Housekeeping", "Breakfast", "Reception"],
    startDate: "",
    endDate: "",
    window: "Short-term or seasonal",
    details: "Staff bed, breakfast, discounts",
    status: "Approved",
  },
  {
    name: "Canal House Hostel",
    location: "Amsterdam, Netherlands",
    roles: ["Reception", "Events", "Night shift"],
    startDate: "",
    endDate: "",
    window: "Seasonal or longer-term",
    details: "Paid hourly role, staff meals",
    status: "Approved",
  },
  {
    name: "Sunset Surf Hostel",
    location: "Lagos, Portugal",
    roles: ["Bar", "Tours", "Social media"],
    startDate: "",
    endDate: "",
    window: "Short-term trial or longer stay",
    details: "Accommodation, breakfast, surf discounts",
    status: "Reviewing",
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
  select.querySelector('option[value="hostel-partner"]').disabled = type !== "hostel";
  select.querySelector('option[value="worker-basic"]').disabled = type === "hostel";
  select.querySelector('option[value="worker-premium"]').disabled = type === "hostel";
  if (type === "hostel") select.value = "hostel-partner";
  if (type === "worker" && select.value === "hostel-partner") select.value = "worker-basic";
  select.closest("form")?.querySelectorAll(".worker-nationality-field").forEach((field) => {
    field.hidden = type === "hostel";
  });
  select.closest("form")?.querySelectorAll(".hostel-website-field").forEach((field) => {
    field.hidden = type !== "hostel";
  });
  select.closest("form")?.querySelectorAll(".hostel-photo-field").forEach((field) => {
    field.hidden = type !== "hostel";
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
  profileForm.elements.photoData.value = profile.photo || "";
  profileForm.elements.photosData.value = JSON.stringify(Array.isArray(profile.photos) ? profile.photos.slice(0, 10) : []);
  syncPlanOptions(account.type, profileForm.elements.plan);
  profileForm.elements.plan.value = profile.plan || (account.type === "hostel" ? "hostel-partner" : "worker-basic");
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
                <strong>${escapeHtml(application.type === "hostel" ? "Hostel profile" : "Worker profile")}</strong>
                <p>${escapeHtml(application.planLabel || "Plan pending")}</p>
              </div>
              <span class="status-pill status-${escapeHtml(application.status)}">${escapeHtml(application.status)}</span>
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
  const parts = String(opening.location || "").split(",");
  return (parts[parts.length - 1] || "").trim();
}

function submissionToOpening(submission) {
  const data = submission.data || {};
  return {
    name: data.name || "Approved hostel",
    location: data.location || "Location pending",
    roles: valuesList(data.roles || data.role),
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    window: dateRange(data.startDate, data.endDate),
    details: data.description || "Details available after approval",
    status: "Approved",
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
          <h3>${escapeHtml(opening.name)}</h3>
          <p class="location">+ ${escapeHtml(opening.location)}</p>
        </div>
        <span class="badge">${escapeHtml(opening.status)}</span>
      </div>
      <div class="profile-meta">
        <div>
          <span class="label">Opening window</span>
          <p>${escapeHtml(opening.window)}</p>
        </div>
        <div>
          <span class="label">Roles open</span>
          <div class="tag-list">${tagList(opening.roles)}</div>
        </div>
        <div>
          <span class="label">Placement details</span>
          <p>${escapeHtml(opening.details)}</p>
        </div>
      </div>
      <button class="button button-light save-opening" type="button" data-opening-id="${escapeHtml(id)}">
        ${saved ? "Saved" : "Save opening"}
      </button>
      <a class="button button-dark" href="./opening-apply.html?name=${encodeURIComponent(opening.name)}&location=${encodeURIComponent(opening.location)}">Apply</a>
    </article>
  `;
}

function openingId(opening) {
  return `${opening.name}|${opening.location}|${opening.window}`;
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
  return openings.filter((opening) => {
    const roleMatches =
      !roles.length ||
      roles.some((role) => opening.roles.some((item) => item.toLowerCase() === role || item.toLowerCase().includes(role)));
    const countryMatches = !country || openingCountry(opening) === country;
    return roleMatches && countryMatches && openingMatchesDates(opening, startDate, endDate);
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
  const threads = workerThreads(account);
  const applicationList = document.querySelector("#worker-application-list");
  const threadList = document.querySelector("#worker-thread-list");
  const empty = `<p class="empty-state">Applications you submit from opening pages will appear here.</p>`;
  applicationList.innerHTML = threads.length
    ? threads
        .map(
          (thread) => `
            <article>
              <div>
                <strong>${escapeHtml(thread.opening?.name || "Hostel opening")}</strong>
                <p>${escapeHtml(thread.opening?.location || "Location pending")} · ${escapeHtml(formatDateTime(thread.createdAt))}</p>
              </div>
              <a class="text-button" href="${escapeHtml(threadHref(thread))}">View</a>
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
  const threads = hostelThreads(account);
  list.innerHTML = threads.length
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
  workerAccountHome.hidden = isHostel;
  hostelAccountHome.hidden = !isHostel;
  if (isHostel) renderHostelLanding(account);
  else renderWorkerLanding(account);
}

function showDashboard(payload) {
  currentAccount = payload.account;
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
    const payload = await fetchJson("/api/account/register", {
      method: "POST",
      body: JSON.stringify({
        type: formData.get("type"),
        email: formData.get("email"),
        password: formData.get("password"),
        profile,
      }),
    });
    registerForm.reset();
    showDashboard(payload);
    showToast("Account created.");
    continueToNext();
  } catch (error) {
    showToast(error.message || "Could not create account.");
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

populateNationalitySelects();
syncPlanOptions(registerForm.elements.type.value, registerForm.elements.plan);
fetchJson("/api/account/session")
  .then((payload) => {
    if (payload.authenticated) {
      if (!continueToNext()) showDashboard(payload);
    }
  })
  .catch(() => {});
