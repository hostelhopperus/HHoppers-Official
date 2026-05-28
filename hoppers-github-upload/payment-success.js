const paymentStatus = document.querySelector("#payment-status");

const planLabels = {
  "worker-basic": "Worker Basic Plan",
  "worker-premium": "Worker Premium Plan",
  "hostel-basic": "Hostel Basic Plan",
  "hostel-premium": "Hostel Premium Plan",
};

function setPaymentStatus(title, message) {
  paymentStatus.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
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

async function finishPaidSignup() {
  const params = new URLSearchParams(window.location.search);
  const paymentLooksSuccessful =
    params.get("payment") === "success" ||
    params.get("paid") === "true" ||
    params.get("redirect_status") === "succeeded" ||
    params.get("stripe_success") === "true";

  const pending = sessionStorage.getItem("hoppersPendingAccount");
  if (!paymentLooksSuccessful) {
    setPaymentStatus(
      "Payment is not confirmed yet.",
      "Use a Stripe success URL like payment-success.html?payment=success so Hoppers knows Stripe sent the customer back after payment."
    );
    return;
  }

  if (!pending) {
    setPaymentStatus(
      "No pending signup found.",
      "Start again from Create profile. Hoppers only creates the account when the paid signup data is still in this browser tab."
    );
    return;
  }

  try {
    const account = JSON.parse(pending);
    await fetchJson("/api/account/register", {
      method: "POST",
      body: JSON.stringify({
        type: account.type,
        email: account.email,
        password: account.password,
        profile: account.profile,
        billing: {
          provider: "stripe",
          status: "paid",
          plan: account.plan,
          planLabel: planLabels[account.plan] || account.plan,
          paidAt: new Date().toISOString(),
        },
      }),
    });
    sessionStorage.removeItem("hoppersPendingAccount");
    setPaymentStatus("Account created.", "Opening your Hoppers dashboard now.");
    window.setTimeout(() => {
      window.location.href = "./account.html";
    }, 900);
  } catch (error) {
    setPaymentStatus("Payment worked, but account creation needs attention.", error.message || "Try signing in or contact Hoppers support.");
  }
}

finishPaidSignup();
