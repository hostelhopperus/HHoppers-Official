const resetForm = document.querySelector("#reset-form");
const resetStatus = document.querySelector("#reset-status");
const toast = document.querySelector("#toast");
const token = new URLSearchParams(window.location.search).get("token") || "";

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

if (!token) {
  resetStatus.textContent = "This reset link is missing its secure token. Ask for a fresh reset email.";
  resetForm.querySelector('button[type="submit"]').disabled = true;
}

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(resetForm);
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const button = resetForm.querySelector('button[type="submit"]');
  if (password !== confirmPassword) {
    showToast("The passwords do not match.");
    return;
  }
  button.disabled = true;
  resetStatus.textContent = "";
  try {
    await fetchJson("/api/account/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    resetStatus.textContent = "Password reset. Opening your account...";
    showToast("Password updated.");
    window.setTimeout(() => {
      window.location.href = "./account.html";
    }, 700);
  } catch (error) {
    resetStatus.textContent = error.message || "This reset link could not be used.";
    showToast(error.message || "Could not reset password.");
  } finally {
    button.disabled = false;
  }
});
