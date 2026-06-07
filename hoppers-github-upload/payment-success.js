
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
  const pending = pendingSignup();
  const paymentLooksSuccessful =
    params.get("payment") === "success" ||
    params.get("paid") === "true" ||
    params.get("redirect_status") === "succeeded" ||
    params.get("stripe_success") === "true";
  const checkoutSessionId = params.get("session_id") || params.get("checkout_session_id") || params.get("session");

  if (!paymentLooksSuccessful && !pending) {
    setPaymentStatus(
      "Payment is not confirmed yet.",
      "Use the secure payment page from Hoppers signup first. If your card was charged, contact Hoppers with the Stripe receipt email."
    );
    return;
  }

  try {
    setPaymentStatus(
      checkoutSessionId ? "Confirming Stripe payment..." : "Finding your paid Stripe checkout...",
      "Do not pay again. Hoppers is matching your payment to the profile you started."
    );
    const endpoint = checkoutSessionId ? "/api/account/complete-paid-signup" : "/api/account/recover-paid-signup";
    await fetchJson(endpoint, {
      method: "POST",
      body: JSON.stringify({
        stripeCheckoutSessionId: checkoutSessionId,
        clientReferenceId: pending?.clientReferenceId || pending?.signupId || "",
        email: pending?.email || "",
        plan: pending?.plan || "",
        type: pending?.type || "",
      }),
    });
    sessionStorage.removeItem("hoppersPendingAccount");
    setPaymentStatus("Account created.", "Opening your Hoppers dashboard now.");
    window.setTimeout(() => {
      window.location.href = "./account.html";
    }, 900);
  } catch (error) {
    setPaymentStatus(
      "Payment worked, but account activation needs attention.",
      error.message || "Try again in a minute, then contact Hoppers support with your Stripe receipt email."
    );
  }
}

finishPaidSignup();
