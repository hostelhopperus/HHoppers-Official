const headerSignin = document.querySelector(".header-signin");

async function siteFetchJson(url, options = {}) {
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

function installLogoutButton() {
  if (!headerSignin || document.querySelector(".header-logout")) return;
  const button = document.createElement("button");
  button.className = "header-logout";
  button.type = "button";
  button.textContent = "Log out";
  button.addEventListener("click", async () => {
    await siteFetchJson("/api/account/logout", { method: "POST" }).catch(() => {});
    window.location.href = "./index.html";
  });
  headerSignin.insertAdjacentElement("afterend", button);
}

siteFetchJson("/api/account/session")
  .then((payload) => {
    if (!payload.authenticated || !headerSignin) return;
    headerSignin.textContent = "Account";
    headerSignin.href = "./account.html";
    installLogoutButton();
  })
  .catch(() => {});
