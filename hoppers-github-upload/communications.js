const threadList = document.querySelector("#thread-list");
const emptyState = document.querySelector("#conversation-empty");
const detail = document.querySelector("#conversation-detail");
const replyForm = document.querySelector("#reply-form");
const toast = document.querySelector("#toast");

let threads = [];
let activeThreadId = "";
let currentAccount = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function messageSide(message) {
  if (message.role === "worker" || message.role === "hostel" || message.role === "system") return message.role;
  const sender = String(message.sender || "").toLowerCase();
  if (sender.includes("worker")) return "worker";
  if (sender.includes("hostel")) return "hostel";
  return "system";
}

function senderLabel(message, thread) {
  const side = messageSide(message);
  const sender = String(message.sender || "");
  const genericSender = !sender || sender === "You" || sender === "Worker" || sender === "Hostel" || sender.toLowerCase().includes("worker");
  if (side === "worker") return genericSender ? thread.worker?.name || "Worker" : sender;
  if (side === "hostel") return !sender || sender === "Hostel" || sender.toLowerCase().includes("hostel") ? thread.opening?.name || "Hostel" : sender;
  return message.sender || "System";
}

async function fetchSession() {
  try {
    const response = await fetch("/api/account/session", {
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    currentAccount = body.authenticated ? body.account : null;
  } catch {
    currentAccount = null;
  }
}

function readThreads() {
  try {
    return JSON.parse(localStorage.getItem("hoppers_communications") || "[]");
  } catch {
    return [];
  }
}

function saveThreads() {
  localStorage.setItem("hoppers_communications", JSON.stringify(threads));
}

function renderThreadList() {
  threadList.innerHTML = threads.length
    ? threads
        .map(
          (thread) => `
            <button class="thread-item ${thread.id === activeThreadId ? "active" : ""}" type="button" data-thread-id="${escapeHtml(thread.id)}">
              <strong>${escapeHtml(thread.opening?.name || "Hostel opening")}</strong>
              <span>${escapeHtml(thread.worker?.name || "Worker")} · ${escapeHtml(thread.status || "Application sent")}</span>
              <small>${escapeHtml(formatDate(thread.updatedAt || thread.createdAt))}</small>
            </button>
          `
        )
        .join("")
    : `<p class="empty-state">No communications yet. Open a hostel listing and send an application to start one.</p>`;
}

function renderConversation() {
  const thread = threads.find((item) => item.id === activeThreadId);
  emptyState.hidden = Boolean(thread);
  detail.hidden = !thread;
  renderThreadList();
  if (!thread) return;

  document.querySelector("#conversation-title").textContent = thread.opening?.name || "Hostel opening";
  document.querySelector("#conversation-meta").textContent = `${thread.opening?.location || "Location pending"} · ${thread.worker?.email || "No email"}`;
  const status = document.querySelector("#conversation-status");
  status.textContent = thread.status || "Application sent";
  status.className = "status-pill status-pending";
  document.querySelector("#message-timeline").innerHTML = (thread.messages || [])
    .map(
      (message) => {
        const side = messageSide(message);
        return `
        <article class="message-card message-${escapeHtml(side)}">
          <div>
            <strong>${escapeHtml(senderLabel(message, thread))}</strong>
            <span>${escapeHtml(formatDate(message.sentAt))}</span>
          </div>
          <p>${escapeHtml(message.body)}</p>
        </article>
      `;
      }
    )
    .join("");
}

threadList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-thread-id]");
  if (!button) return;
  activeThreadId = button.dataset.threadId;
  renderConversation();
});

replyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const thread = threads.find((item) => item.id === activeThreadId);
  if (!thread) return;
  const formData = new FormData(replyForm);
  const body = String(formData.get("reply") || "").trim();
  if (!body) return;
  const now = new Date().toISOString();
  const role = currentAccount?.type === "hostel" ? "hostel" : "worker";
  const sender = currentAccount?.profile?.name || (role === "hostel" ? thread.opening?.name : thread.worker?.name) || "You";
  thread.messages = [
    ...(thread.messages || []),
    {
      role,
      sender,
      sentAt: now,
      body,
    },
  ];
  thread.updatedAt = now;
  saveThreads();
  replyForm.reset();
  renderConversation();
  showToast("Message added to the thread.");
});

async function init() {
  await fetchSession();
  threads = readThreads();
  const params = new URLSearchParams(window.location.search);
  activeThreadId = params.get("thread") || threads[0]?.id || "";
  renderConversation();
}

init();
