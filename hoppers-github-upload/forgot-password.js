const forgotForm = document.querySelector("#forgot-form");
const forgotStatus = document.querySelector("#forgot-status");
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
  forgotStatus.textContent = "";
  try {
    const result = await fetchJson("/api/account/forgot", {
      method: "POST",
      body: JSON.stringify({ email: formData.get("email") }),
    });
    forgotStatus.textContent = result.message || "If that email is on Hoppers, a reset email is on the way.";
    showToast("Check your email for the reset link.");
  } catch (error) {
    showToast(error.message || "Could not send reset link.");
  } finally {
    button.disabled = false;
  }
});
