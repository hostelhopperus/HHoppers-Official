const workerProfiles = [
  {
    name: "Maya R.",
    location: "Lisbon, Portugal",
    availability: "June - September",
    skills: ["Reception", "Events", "Housekeeping"],
    languages: "English, Spanish",
    rating: "4.9",
    verified: ["Profile reviewed", "Reference checked", "Completed placement"],
  },
  {
    name: "Jonas V.",
    location: "Amsterdam, Netherlands",
    availability: "July - October",
    skills: ["Bar", "Night audit", "Guest experience"],
    languages: "Dutch, English, German",
    rating: "4.8",
    verified: ["ID checked", "Profile reviewed"],
  },
  {
    name: "Sofia L.",
    location: "Barcelona, Spain",
    availability: "August - November",
    skills: ["Social media", "Tours", "Reception"],
    languages: "English, Italian, Spanish",
    rating: "5.0",
    verified: ["Profile reviewed", "Reference checked"],
  },
];

const hostelProfiles = [
  {
    name: "Alpine Base Hostel",
    location: "Interlaken, Switzerland",
    needs: ["Housekeeping", "Breakfast", "Reception"],
    stay: "Short-term or seasonal",
    benefits: "Staff bed, breakfast, discounts",
    details:
      "A mountain base looking for practical help through busy guest weeks. Good for travelers who want a short stay, with room to extend if the fit is right.",
    verified: true,
  },
  {
    name: "Canal House Hostel",
    location: "Amsterdam, Netherlands",
    needs: ["Reception", "Events", "Night shift"],
    stay: "Seasonal or longer-term",
    benefits: "Paid hourly role, staff meals",
    details:
      "A city hostel with structured shifts and guest-facing work. Best for someone comfortable with steady schedules, late arrivals, and staying through a longer stretch.",
    verified: true,
  },
  {
    name: "Sunset Surf Hostel",
    location: "Lagos, Portugal",
    needs: ["Bar", "Tours", "Social media"],
    stay: "Short-term trial or longer stay",
    benefits: "Accommodation, breakfast, surf discounts",
    details:
      "A social hostel near the water with flexible role needs. Start with a shorter trial, then continue if the timing, team, and workload feel right.",
    verified: false,
  },
];

const samplePilotOpenings = [
  {
    name: "Reception Helper",
    role: "Reception Helper",
    hostelName: "Sample Lisbon Hostel",
    city: "Lisbon",
    country: "Portugal",
    location: "Lisbon, Portugal",
    needs: ["Reception", "Guest support"],
    startMonth: "July 2026",
    duration: "4-8 weeks",
    hours: "20/week",
    housing: "Bed included",
    meals: "Breakfast included",
    type: "Work exchange",
    languages: ["English"],
    minimumStay: "4-8 weeks",
    minimumStayWeeks: 4,
    stay: "July 2026, 4-8 weeks",
    benefits: "Bed + breakfast",
    details: "Sample pilot listing for reception and guest support.",
    verified: false,
    sample: true,
  },
  {
    name: "Social Events Crew",
    role: "Social Events Crew",
    hostelName: "Sample Costa Rica Hostel",
    city: "Costa Rica",
    country: "Costa Rica",
    location: "Costa Rica",
    needs: ["Events", "Guest experience"],
    startMonth: "August 2026",
    duration: "1-3 months",
    hours: "20-25/week",
    housing: "Dorm bed included",
    meals: "Confirm before accepting",
    type: "Work exchange",
    languages: ["English", "Spanish helpful"],
    minimumStay: "1-3 months",
    minimumStayWeeks: 4,
    stay: "August 2026, 1-3 months",
    benefits: "Dorm bed",
    details: "Sample pilot listing for social events and guest energy.",
    verified: false,
    sample: true,
  },
  {
    name: "Surf Hostel All-Rounder",
    role: "Surf Hostel All-Rounder",
    hostelName: "Sample Surf Hostel",
    city: "Ericeira",
    country: "Portugal",
    location: "Ericeira, Portugal",
    needs: ["Reception", "Cleaning", "Events"],
    startMonth: "June 2026",
    duration: "6-10 weeks",
    hours: "25/week",
    housing: "Bed included",
    meals: "Confirm before accepting",
    type: "Paid + housing",
    languages: ["English", "Portuguese helpful"],
    minimumStay: "6-10 weeks",
    minimumStayWeeks: 6,
    stay: "June 2026, 6-10 weeks",
    benefits: "Paid + housing",
    details: "Sample pilot listing for an all-rounder at a surf hostel.",
    verified: false,
    sample: true,
  },
  {
    name: "Night Reception",
    role: "Night Reception",
    hostelName: "Sample Amsterdam Hostel",
    city: "Amsterdam",
    country: "Netherlands",
    location: "Amsterdam, Netherlands",
    needs: ["Reception", "Night shift"],
    startMonth: "September 2026",
    duration: "2-4 months",
    hours: "24/week",
    housing: "Staff room included",
    meals: "Confirm before accepting",
    type: "Paid",
    languages: ["English", "Dutch helpful"],
    minimumStay: "2-4 months",
    minimumStayWeeks: 8,
    stay: "September 2026, 2-4 months",
    benefits: "Paid role, staff room",
    details: "Sample pilot listing for night reception support.",
    verified: false,
    sample: true,
  },
  {
    name: "Housekeeping & Breakfast Support",
    role: "Housekeeping & Breakfast Support",
    hostelName: "Sample Queenstown Hostel",
    city: "Queenstown",
    country: "New Zealand",
    location: "Queenstown, New Zealand",
    needs: ["Housekeeping", "Breakfast", "Cleaning"],
    startMonth: "November 2026",
    duration: "2-3 months",
    hours: "20/week",
    housing: "Bed included",
    meals: "Breakfast included",
    type: "Exchange",
    languages: ["English"],
    minimumStay: "2-3 months",
    minimumStayWeeks: 8,
    stay: "November 2026, 2-3 months",
    benefits: "Bed + breakfast",
    details: "Sample pilot listing for housekeeping and breakfast support.",
    verified: false,
    sample: true,
  },
  {
    name: "Bar / Events Assistant",
    role: "Bar / Events Assistant",
    hostelName: "Sample Budapest Hostel",
    city: "Budapest",
    country: "Hungary",
    location: "Budapest, Hungary",
    needs: ["Bar", "Events"],
    startMonth: "July 2026",
    duration: "1-2 months",
    hours: "20/week",
    housing: "Dorm bed included",
    meals: "Confirm before accepting",
    type: "Paid trial / exchange",
    languages: ["English"],
    minimumStay: "1-2 months",
    minimumStayWeeks: 4,
    stay: "July 2026, 1-2 months",
    benefits: "Dorm bed, paid trial / exchange",
    details: "Sample pilot listing for bar and events support.",
    verified: false,
    sample: true,
  },
];

const workerGrid = document.querySelector("#worker-grid");
const hostelGrid = document.querySelector("#hostel-grid");
const openingGrid = document.querySelector("#opening-grid");
const publicOpeningGrid = document.querySelector("#public-opening-grid");
const publicOpeningFilters = document.querySelector("#public-opening-filters");
const hostelSubhead = document.querySelector("#hostel-subhead");
const searchInput = document.querySelector("#worker-search");
const searchLabel = document.querySelector(".search-label");
const profileTabButtons = document.querySelectorAll("[data-profile-tab]");
const toast = document.querySelector("#toast");

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
  return "Dates flexible";
}

function tagList(items) {
  return items.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("");
}

function openingLink(profile) {
  const params = new URLSearchParams({
    name: profile.role || profile.name || "",
    location: profile.location || "",
  });
  return `./opening-apply.html?${params.toString()}`;
}

function normalizeOpening(profile = {}) {
  const location = profile.location || [profile.city, profile.country].filter(Boolean).join(", ") || "Location pending";
  const parts = String(location)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const role = profile.role || profile.roleNeeded || profile.name || valuesList(profile.needs || profile.roles)[0];
  const type = profile.compensation || profile.type || "Confirm before accepting";
  return {
    ...profile,
    name: profile.name || role,
    role,
    hostelName: profile.hostelName || profile.hostel || (profile.sample ? "Sample pilot partner" : profile.name || "Work provider"),
    location,
    city: profile.city || (parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0] || ""),
    country: profile.country || (parts.length > 1 ? parts.at(-1) : ""),
    roles: valuesList(profile.roles || profile.needs || role),
    startMonth: profile.startMonth || formatDateOnly(profile.startDate) || "Flexible",
    minimumStay: profile.minimumStay || profile.duration || profile.stay || "Flexible",
    minimumStayWeeks: Number(profile.minimumStayWeeks || 0),
    hoursPerWeek: profile.hoursPerWeek || profile.hours || "Confirm before accepting",
    housingIncluded: Boolean(profile.housingIncluded || /bed|housing|room|dorm/i.test(profile.housing || profile.benefits || "")),
    mealsIncluded: Boolean(profile.mealsIncluded || /breakfast|meal/i.test(profile.meals || profile.benefits || "")),
    housing: profile.housing || "Confirm before accepting",
    meals: profile.meals || "Confirm before accepting",
    compensation: type,
    type,
    languages: valuesList(profile.languages || profile.languageRequirements, "Confirm before accepting"),
    pilot: Boolean(profile.pilot || profile.sample || String(profile.status || "").toLowerCase().includes("pilot")),
  };
}

function renderWorker(profile) {
  return `
    <article class="profile-card">
      <div class="profile-card-inner">
        <div class="profile-top">
          <div>
            <h3>${escapeHtml(profile.name)}</h3>
            <p class="location">+ ${escapeHtml(profile.location)}</p>
          </div>
          <span class="badge badge-dark">* ${escapeHtml(profile.rating)}</span>
        </div>
        <div class="profile-meta">
          <div>
            <span class="label">Availability</span>
            <p>${escapeHtml(profile.availability)}</p>
          </div>
          <div>
            <span class="label">Skills</span>
            <div class="tag-list">${tagList(profile.skills)}</div>
          </div>
          <div>
            <span class="label">Languages</span>
            <p>${escapeHtml(profile.languages)}</p>
          </div>
          <div>
            <span class="label">Verification</span>
            <div class="checks">${profile.verified.map((item) => `<span>✓ ${escapeHtml(item)}</span>`).join("")}</div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderHostel(profile) {
  return `
    <article class="profile-card">
      <div class="profile-card-inner">
        <div class="profile-top">
          <div>
            <h3>${escapeHtml(profile.name)}</h3>
            <p class="location">+ ${escapeHtml(profile.location)}</p>
          </div>
          <span class="badge">${profile.verified ? "Verified" : "Reviewing"}</span>
        </div>
        <div class="profile-meta">
          <div>
            <span class="label">Availability</span>
            <p>${escapeHtml(profile.stay)}</p>
          </div>
          <div>
            <span class="label">Roles needed</span>
            <div class="tag-list">${tagList(profile.needs)}</div>
          </div>
          <div>
            <span class="label">Benefits</span>
            <p>${escapeHtml(profile.benefits)}</p>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderOpening(profile) {
  const opening = normalizeOpening(profile);
  return `
    <article class="profile-card opening-card">
      <div class="profile-card-inner">
        <div class="profile-top">
          <div>
            <h3>${escapeHtml(opening.role)}</h3>
            <p class="location">+ ${escapeHtml(opening.hostelName)} · ${escapeHtml(opening.location)}</p>
          </div>
          <span class="badge">${opening.pilot ? "Pilot listing" : opening.verified ? "Approved" : "Reviewing"}</span>
        </div>
        <div class="profile-meta listing-meta-grid">
          <div><span class="label">Start</span><p>${escapeHtml(opening.startMonth)}</p></div>
          <div><span class="label">Minimum stay</span><p>${escapeHtml(opening.minimumStay)}</p></div>
          <div><span class="label">Hours/week</span><p>${escapeHtml(opening.hoursPerWeek)}</p></div>
          <div><span class="label">Housing</span><p>${escapeHtml(opening.housingIncluded ? "Yes" : opening.housing)}</p></div>
          <div><span class="label">Meals</span><p>${escapeHtml(opening.mealsIncluded ? "Yes" : opening.meals)}</p></div>
          <div><span class="label">Type</span><p>${escapeHtml(opening.compensation)}</p></div>
          <div><span class="label">Languages</span><p>${escapeHtml(opening.languages.join(", "))}</p></div>
          <div><span class="label">Roles</span><div class="tag-list">${tagList(opening.roles)}</div></div>
        </div>
        <a class="opening-link" href="${escapeHtml(openingLink(opening))}">Apply</a>
      </div>
    </article>
  `;
}

function openingCountry(profile) {
  if (profile.country) return profile.country;
  const parts = String(profile.location || "").split(",");
  return (parts[parts.length - 1] || "").trim();
}

function openingMatchesDates(profile, startDate, endDate) {
  if (!startDate && !endDate) return true;
  if (!profile.startDate && !profile.endDate) return true;
  const openingStart = profile.startDate || "0000-01-01";
  const openingEnd = profile.endDate || "9999-12-31";
  const workerStart = startDate || "0000-01-01";
  const workerEnd = endDate || "9999-12-31";
  return openingStart <= workerEnd && workerStart <= openingEnd;
}

function submissionToHostel(submission) {
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
    name: data.role || valuesList(data.roles || data.role)[0] || "Travel work role",
    role: data.role || valuesList(data.roles || data.role)[0] || "Travel work role",
    hostelName: data.name || "Approved hostel",
    location,
    city: data.city || (parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0] || ""),
    country: data.country || (parts.length > 1 ? parts.at(-1) : ""),
    needs: valuesList(data.roles || data.role),
    roles: valuesList(data.roles || data.role),
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    startMonth: data.startMonth || formatDateOnly(data.startDate) || "Flexible",
    minimumStay: data.minimumStay || data.duration || dateRange(data.startDate, data.endDate),
    minimumStayWeeks: Number(data.minimumStayWeeks || 0),
    hoursPerWeek: data.hoursPerWeek || data.hours || "Confirm before accepting",
    housingIncluded: Boolean(data.housingIncluded),
    mealsIncluded: Boolean(data.mealsIncluded),
    compensation: data.compensation || data.type || "Confirm before accepting",
    languages: valuesList(data.languages || data.languageRequirements, "Confirm before accepting"),
    stay: dateRange(data.startDate, data.endDate),
    benefits: data.description || "Details available after approval",
    details: data.description || "More details will be shared after the hostel review is complete.",
    verified: true,
    pilot: Boolean(data.pilot),
  };
}

function populatePublicOpeningCountries(openings) {
  const select = document.querySelector("[data-public-opening-country]");
  if (!select) return;
  const countries = [...new Set(openings.map(openingCountry).filter(Boolean))].sort();
  select.innerHTML = `<option value="">Any country</option>${countries
    .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)
    .join("")}`;
}

function filterOpenings(openings, form) {
  const formData = new FormData(form);
  const roles = formData.getAll("roles").map((role) => String(role).toLowerCase());
  const country = String(formData.get("country") || "");
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const housingIncluded = Boolean(formData.get("housingIncluded"));
  const type = String(formData.get("type") || "").toLowerCase();
  const minimumStayWeeks = Number(formData.get("minimumStayWeeks") || 0);
  return openings.filter((opening) => {
    const normalized = normalizeOpening(opening);
    const roleMatches =
      !roles.length ||
      roles.some((role) => normalized.roles.some((item) => item.toLowerCase() === role || item.toLowerCase().includes(role)));
    const countryMatches = !country || openingCountry(normalized) === country;
    const housingMatches = !housingIncluded || Boolean(normalized.housingIncluded);
    const typeMatches = !type || String(normalized.compensation || normalized.type || "").toLowerCase().includes(type);
    const stayMatches = !minimumStayWeeks || !normalized.minimumStayWeeks || Number(normalized.minimumStayWeeks) <= minimumStayWeeks;
    return roleMatches && countryMatches && housingMatches && typeMatches && stayMatches && openingMatchesDates(normalized, startDate, endDate);
  });
}

async function renderOpenings() {
  if (!openingGrid) return;
  openingGrid.innerHTML = `<p class="empty-state">Loading openings...</p>`;
  try {
    const { hostels } = await fetchJson("/api/published/hostels");
    const approvedHostels = hostels.map(submissionToHostel);
    const openings = approvedHostels.length ? approvedHostels : samplePilotOpenings;
    openingGrid.innerHTML = openings.slice(0, 4).map(renderOpening).join("");
  } catch {
    openingGrid.innerHTML = samplePilotOpenings.slice(0, 4).map(renderOpening).join("");
  }
}

async function renderPublicOpenings() {
  if (!publicOpeningGrid || !publicOpeningFilters) return;
  publicOpeningGrid.innerHTML = `<p class="empty-state">Loading openings...</p>`;
  try {
    const { hostels } = await fetchJson("/api/published/hostels");
    const approvedHostels = hostels.map(submissionToHostel);
    const openings = approvedHostels;
    populatePublicOpeningCountries(openings);
    const renderFiltered = () => {
      const filtered = filterOpenings(openings, publicOpeningFilters);
      publicOpeningGrid.innerHTML = filtered.length
        ? filtered.map(renderOpening).join("")
        : `<p class="empty-state">Pilot listings opening soon — join the worker list to get first access.</p>`;
    };
    publicOpeningFilters.addEventListener("input", renderFiltered);
    publicOpeningFilters.addEventListener("change", renderFiltered);
    renderFiltered();
  } catch {
    populatePublicOpeningCountries([]);
    publicOpeningGrid.innerHTML = `<p class="empty-state">Pilot listings opening soon — join the worker list to get first access.</p>`;
  }
}

async function renderHostels() {
  if (!hostelGrid) return;
  hostelGrid.innerHTML = `<p class="empty-state">Loading hostel profiles...</p>`;
  try {
    const { hostels } = await fetchJson("/api/published/hostels");
    const approvedHostels = hostels.map(submissionToHostel);
    const allHostels = [...hostelProfiles, ...approvedHostels];
    hostelGrid.innerHTML = allHostels.map(renderHostel).join("");
  } catch {
    hostelGrid.innerHTML = hostelProfiles.map(renderHostel).join("");
  }
}

function setProfileTab(tabName) {
  if (!workerGrid || !hostelGrid || !hostelSubhead || !searchLabel) return;
  const showingWorkers = tabName === "workers";
  profileTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.profileTab === tabName);
  });
  workerGrid.hidden = !showingWorkers;
  searchLabel.hidden = !showingWorkers;
  hostelSubhead.hidden = showingWorkers;
  hostelGrid.hidden = showingWorkers;
}

function submissionFromForm(form) {
  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => {
    if (data[key]) {
      data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
    } else {
      data[key] = value;
    }
  });
  const type = form.id === "hostel-form" ? "hostel" : "worker";
  data.plan = data.plan || (type === "hostel" ? "hostel-partner" : "worker-basic");
  return { type, data };
}

function renderWorkers() {
  if (!workerGrid || !searchInput) return;
  const query = searchInput.value.trim().toLowerCase();
  const filtered = workerProfiles.filter((profile) => {
    const text = `${profile.name} ${profile.location} ${profile.skills.join(" ")} ${profile.languages}`.toLowerCase();
    return text.includes(query);
  });

  workerGrid.innerHTML = filtered.length
    ? filtered.map(renderWorker).join("")
    : `<p class="empty-state">No workers match that search yet.</p>`;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

if (searchInput) searchInput.addEventListener("input", renderWorkers);
profileTabButtons.forEach((button) => {
  button.addEventListener("click", () => setProfileTab(button.dataset.profileTab));
});

renderHostels();
renderOpenings();
renderPublicOpenings();
renderWorkers();
if (profileTabButtons.length) setProfileTab("workers");

document.querySelectorAll(".signup-form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = form.id === "hostel-form" ? "hostel" : "worker";
    const selectedOptions = form.querySelectorAll('input[type="checkbox"]:checked');
    const startDate = form.querySelector('[name="startDate"]').value;
    const endDate = form.querySelector('[name="endDate"]').value;
    if (!selectedOptions.length) {
      showToast(type === "hostel" ? "Choose at least one role." : "Choose at least one skill.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      showToast("End date must be after the start date.");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await fetchJson("/api/submissions", {
        method: "POST",
        body: JSON.stringify(submissionFromForm(form)),
      });
      form.reset();
      if (result.checkoutUrl) {
        showToast("Profile saved. Opening secure Stripe checkout...");
        window.location.href = result.checkoutUrl;
        return;
      }
      showToast("Application saved. Billing setup will come later if approved.");
    } catch (error) {
      showToast(error.message || "Could not save submission.");
    } finally {
      button.disabled = false;
    }
  });
});
