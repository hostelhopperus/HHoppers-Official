const pendingSignup = (() => {
  try {
    return JSON.parse(sessionStorage.getItem("hoppersPendingAccount") || "null");
  } catch {
    return null;
  }
})();

function safeStripeReference(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 200);
}

function decorateStripeCheckout() {
  if (!pendingSignup) return;
  const reference = safeStripeReference(pendingSignup.clientReferenceId || pendingSignup.signupId);
  const email = String(pendingSignup.email || "").trim();
  const buyButton = document.querySelector("stripe-buy-button");
  if (buyButton && reference) buyButton.setAttribute("client-reference-id", reference);
  if (buyButton && email) buyButton.setAttribute("customer-email", email);

  const fallback = document.querySelector(".checkout-fallback a");
  if (fallback && reference) {
    const url = new URL(fallback.href);
    url.searchParams.set("client_reference_id", reference);
    if (email) url.searchParams.set("prefilled_email", email);
    fallback.href = url.toString();
  }
}

decorateStripeCheckout();
