if (!sessionStorage.getItem("hoppersPendingAccount")) {
  const warning = document.createElement("div");
  warning.className = "plan-summary payment-warning";
  warning.innerHTML = "<strong>Start from signup first.</strong><span>This payment page needs pending account details before Hoppers can create an account after payment.</span>";
  document.querySelector(".payment-card")?.prepend(warning);
}
