const signinForm = document.querySelector("#signin-form");
const createProfileForm = document.querySelector("#create-profile-form");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const signinTypeButtons = document.querySelectorAll("[data-signin-type]");
const signinTypeTitle = document.querySelector("#signin-type-title");
const signinTypeCopy = document.querySelector("#signin-type-copy");
const createNameLabel = document.querySelector("#create-name-label");
const createTagsLegend = document.querySelector("#create-tags-legend");
const createStartLabel = document.querySelector("#create-start-label");
const createEndLabel = document.querySelector("#create-end-label");
const createPlanOptions = document.querySelector("#create-plan-options");
const planSummary = document.querySelector("#plan-summary");
const toast = document.querySelector("#toast");

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

let selectedType = "worker";
let selectedMode = "signin";

const signupPlans = {
  "worker-basic": {
    type: "worker",
    name: "Worker Basic Plan",
    price: "$2.99/month",
    features: [
      "Create profile",
      "Apply to limited hostels",
      "Upload basic info, skills, dates, and languages",
      "Get reviews after placements",
    ],
  },
  "worker-premium": {
    type: "worker",
    name: "Worker Premium Plan",
    price: "$5.99/month",
    features: [
      "Everything in Basic",
      "Verified profile badge",
      "Apply to unlimited hostels",
      "Appear higher in hostel searches",
      "Add video intro",
      "Priority placement alerts",
      "Profile boosts",
      "More photos and references",
    ],
  },
  "hostel-basic": {
    type: "hostel",
    name: "Hostel Basic Plan",
    price: "$99/month",
    features: [
      "Hostel profile page",
      "Post basic work opportunities",
      "Receive worker applications",
      "View limited worker profiles",
      "Basic messaging/contact",
    ],
  },
  "hostel-premium": {
    type: "hostel",
    name: "Hostel Premium Plan",
    price: "$199/month",
    features: [
      "Everything in Basic",
      "Featured hostel placement",
      "Unlimited job/volunteer postings",
      "Full access to verified worker profiles",
      "Reviews/ratings from past placements",
      "Priority ranking in search",
      "Direct messaging with workers",
      "Application tracking dashboard",
      "Verified Hostel badge",
      "Support from Hoppers",
    ],
  },
};

const paymentPages = {
  "worker-basic": "./payment-worker-basic.html",
  "worker-premium": "./payment-worker-premium.html",
  "hostel-basic": "./payment-hostel-basic.html",
  "hostel-premium": "./payment-hostel-premium.html",
};

const panelCopy = {
  signin: {
    worker: {
      title: "Worker sign in",
      copy: "Open your worker profile, placement details, reviews, and account settings.",
    },
    hostel: {
      title: "Hostel sign in",
      copy: "Open your hostel profile, partner details, applications, and account settings.",
    },
  },
  create: {
    worker: {
      title: "Create a worker profile",
      copy: "Start a reviewed worker profile with your skills, dates, languages, and placement preferences.",
    },
    hostel: {
      title: "Create a hostel profile",
      copy: "Start a reviewed hostel profile with your open roles, timing, location, and placement details.",
    },
  },
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
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

function saveSignupDraft(signup) {
  if (window.location.protocol === "file:") {
    throw new Error("Open the live Hoppers site or localhost before starting paid signup.");
  }
  const pending = {
    ...signup,
    email: String(signup.email || "").trim(),
    clientReferenceId: signup.clientReferenceId || createClientReferenceId(),
    paymentPage: paymentPages[signup.plan] || "./payment.html",
  };
  sessionStorage.setItem("hoppersPendingAccount", JSON.stringify(pending));
  return pending;
}

function syncPlanOptions() {
  const currentPlan = createProfileForm.elements.plan.value;
  const availablePlans = Object.entries(signupPlans).filter(([, plan]) => plan.type === selectedType);
  const selectedPlan = availablePlans.some(([key]) => key === currentPlan) ? currentPlan : availablePlans[0][0];
  createProfileForm.elements.plan.value = selectedPlan;
  createPlanOptions.innerHTML = availablePlans
    .map(([key, plan]) => {
      const features = plan.features.map((feature) => `<li>${feature}</li>`).join("");
      return `
        <label class="plan-option">
          <input name="plan-card" type="radio" value="${key}" ${key === selectedPlan ? "checked" : ""} />
          <span>
            <strong>${plan.name}</strong>
            <span class="plan-price">${plan.price}</span>
            <ul class="plan-features">${features}</ul>
          </span>
        </label>
      `;
    })
    .join("");
  createPlanOptions.querySelectorAll('input[name="plan-card"]').forEach((input) => {
    input.addEventListener("change", () => {
      createProfileForm.elements.plan.value = input.value;
      renderPlanSummary(input.value);
    });
  });
  renderPlanSummary(selectedPlan);
  createProfileForm.querySelectorAll(".worker-nationality-field").forEach((field) => {
    field.hidden = selectedType === "hostel";
  });
  createProfileForm.querySelectorAll(".worker-age-field, .worker-gender-field").forEach((field) => {
    field.hidden = selectedType === "hostel";
  });
  createProfileForm.querySelectorAll(".hostel-website-field").forEach((field) => {
    field.hidden = selectedType !== "hostel";
  });
}

function renderPlanSummary(planKey) {
  const plan = signupPlans[planKey];
  if (!plan) return;
  planSummary.innerHTML = `
    <strong>${plan.name}</strong>
    <span>${plan.price}. Payment will be handled by Stripe before Hoppers creates this account.</span>
  `;
}

function createClientReferenceId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `hoppers_${Date.now()}_${randomPart}`;
}

function populateNationalitySelects() {
  document.querySelectorAll("[data-nationality-select]").forEach((select) => {
    select.innerHTML = `<option value="">Select nationality</option>${countries.map((country) => `<option value="${country}">${country}</option>`).join("")}`;
  });
}

function populateAgeSelects() {
  const options = Array.from({ length: 82 }, (_, index) => 18 + index)
    .map((age) => `<option value="${age}">${age}</option>`)
    .join("");
  document.querySelectorAll("[data-age-select]").forEach((select) => {
    select.innerHTML = `<option value="">Select age</option>${options}`;
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

function syncPanel() {
  const copy = panelCopy[selectedMode][selectedType];
  signinTypeTitle.textContent = copy.title;
  signinTypeCopy.textContent = copy.copy;
  signinForm.hidden = selectedMode !== "signin";
  createProfileForm.hidden = selectedMode !== "create";

  createProfileForm.querySelectorAll(".worker-name-field").forEach((field) => {
    field.hidden = selectedType !== "worker";
    field.querySelector("input").required = selectedType === "worker";
  });
  createProfileForm.querySelectorAll(".hostel-name-field").forEach((field) => {
    field.hidden = selectedType !== "hostel";
    field.querySelector("input").required = selectedType === "hostel";
  });
  createNameLabel.textContent = "Hostel name";
  createTagsLegend.textContent = selectedType === "hostel" ? "Roles needed" : "Skills";
  createStartLabel.textContent = selectedType === "hostel" ? "Placement start date" : "Available start date";
  createEndLabel.textContent = selectedType === "hostel" ? "Placement end date" : "Available end date";
  syncPlanOptions();
}

async function profileFromCreateForm() {
  const formData = new FormData(createProfileForm);
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  if (startDate && endDate && endDate < startDate) {
    throw new Error("End date must be after the start date.");
  }
  const photoFile = createProfileForm.elements.photo?.files?.[0];
  if (photoFile && !photoFile.type.startsWith("image/")) throw new Error("Choose an image file for the profile photo.");
  if (photoFile && photoFile.size > 900 * 1024) throw new Error("Profile photo must be under 900 KB.");
  const firstName = selectedType === "worker" ? String(formData.get("firstName") || "").trim() : "";
  const lastName = selectedType === "worker" ? String(formData.get("lastName") || "").trim() : "";
  const displayName = selectedType === "worker" ? [firstName, lastName].filter(Boolean).join(" ") : String(formData.get("name") || "").trim();
  return {
    name: displayName,
    firstName,
    lastName,
    location: "",
    website: selectedType === "hostel" ? String(formData.get("website") || "").trim() : "",
    nationality: selectedType === "worker" ? String(formData.get("nationality") || "").trim() : "",
    age: selectedType === "worker" ? String(formData.get("age") || "").trim() : "",
    gender: selectedType === "worker" ? String(formData.get("gender") || "").trim() : "",
    photo: photoFile ? await fileToDataUrl(photoFile) : "",
    tags: formData.getAll("tags"),
    startDate,
    endDate,
    plan: String(formData.get("plan") || ""),
    bio: String(formData.get("bio") || "").trim(),
  };
}

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedMode = button.dataset.authMode;
    authModeButtons.forEach((item) => item.classList.toggle("active", item === button));
    syncPanel();
  });
});

signinTypeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedType = button.dataset.signinType;
    signinTypeButtons.forEach((item) => item.classList.toggle("active", item === button));
    syncPanel();
  });
});

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signinForm);
  const button = signinForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await fetchJson("/api/account/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    showToast("Signed in. Opening your dashboard...");
    window.setTimeout(() => {
      window.location.href = "./account.html";
    }, 500);
  } catch (error) {
    showToast(error.message || "Could not sign in.");
  } finally {
    button.disabled = false;
  }
});

createProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createProfileForm);
  const button = createProfileForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const profile = await profileFromCreateForm();
    const plan = profile.plan;
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    if (password !== confirmPassword) throw new Error("Passwords must match.");
    if (selectedType === "worker" && !profile.age) throw new Error("Select your age.");
    if (selectedType === "worker" && !profile.gender) throw new Error("Select your gender.");
    const clientReferenceId = createClientReferenceId();
    const pending = saveSignupDraft({
      type: selectedType,
      email,
      password,
      profile,
      plan,
      clientReferenceId,
      startedAt: new Date().toISOString(),
    });
    showToast("Opening payment page...");
    window.setTimeout(() => {
      window.location.href = pending.paymentPage || paymentPages[plan] || "./payment.html";
    }, 350);
  } catch (error) {
    showToast(error.message || "Could not prepare payment.");
  } finally {
    button.disabled = false;
  }
});

createPlanOptions.addEventListener("click", (event) => {
  const input = event.target.closest(".plan-option")?.querySelector('input[name="plan-card"]');
  if (!input) return;
  input.checked = true;
  createProfileForm.elements.plan.value = input.value;
  renderPlanSummary(input.value);
});

populateNationalitySelects();
populateAgeSelects();
syncPanel();
