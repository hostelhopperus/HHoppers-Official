const forgotForm = document.querySelector("#forgot-form");
const forgotStatus = document.querySelector("#forgot-status");
const usernameForm = document.querySelector("#username-form");
const usernameStatus = document.querySelector("#username-status");
const toast = document.querySelector("#toast");

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

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = forgotForm.querySelector('button[type="submit"]');
  const formData = new FormData(forgotForm);
  button.disabled = true;
  forgotStatus.textContent = "Submitting recovery request...";
  try {
    const result = await fetchJson("/api/account/forgot", {
      method: "POST",
      body: JSON.stringify({ email: formData.get("email") }),
    });
    forgotStatus.textContent = result.message || "If that email is on Hoppers, Hoppers will help reset it.";
    showToast("Recovery request sent.");
  } catch (error) {
    forgotStatus.textContent = error.message || "Could not request reset.";
    showToast(error.message || "Could not request reset.");
  } finally {
    button.disabled = false;
  }
});

usernameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = usernameForm.querySelector('button[type="submit"]');
  const formData = new FormData(usernameForm);
  button.disabled = true;
  usernameStatus.textContent = "Sending username request...";
  try {
    const result = await fetchJson("/api/account/recovery-request", {
      method: "POST",
      body: JSON.stringify({
        requestType: "username",
        accountType: formData.get("accountType"),
        profileName: formData.get("profileName"),
        contact: formData.get("contact"),
        details: formData.get("details"),
      }),
    });
    usernameStatus.textContent = result.message || "Hoppers received your username recovery request.";
    usernameForm.reset();
    showToast("Username request sent.");
  } catch (error) {
    usernameStatus.textContent = error.message || "Could not send username request.";
    showToast(error.message || "Could not send request.");
  } finally {
    button.disabled = false;
  }
});
