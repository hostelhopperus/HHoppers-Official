
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

function pendingSignup() {
  try {
    return JSON.parse(sessionStorage.getItem("hoppersPendingAccount") || "null");
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("Account creation needs the Hoppers server. Open the live site or localhost, not a file:// copy.");
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

async function finishPaidSignup() {
  const params = new URLSearchParams(window.location.search);
  const paymentLooksSuccessful =
    params.get("payment") === "success" ||
    params.get("paid") === "true" ||
    params.get("redirect_status") === "succeeded" ||
    params.get("stripe_success") === "true";
  const checkoutSessionId = params.get("session_id") || params.get("checkout_session_id") || params.get("session");

  if (!paymentLooksSuccessful) {
    setPaymentStatus(
      "Payment is not confirmed yet.",
      "Use a Stripe success URL like payment-success.html?payment=success so Hoppers knows Stripe sent the customer back after payment."
    );
    return;
  }

  if (!checkoutSessionId) {
    setPaymentStatus(
      "Payment return is missing a Stripe session.",
      "Do not pay again. The Stripe payment link needs to send Hoppers the checkout session so we can activate the account."
    );
    return;
  }

  try {
    const pending = pendingSignup();
    await fetchJson("/api/account/complete-paid-signup", {
      method: "POST",
      body: JSON.stringify({
        stripeCheckoutSessionId: checkoutSessionId,
        clientReferenceId: pending?.clientReferenceId || pending?.signupId || "",
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
