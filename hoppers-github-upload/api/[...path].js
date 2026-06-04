const crypto = require("node:crypto");
const tls = require("node:tls");

function smtpSettings() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.GMAIL_EMAIL;
  const pass = String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  const host = process.env.SMTP_HOST || (user && user.endsWith("@gmail.com") ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT || 465);
  if (!host || !user || !pass) return null;
  return {
    host,
    port,
    user,
    pass,
    from: process.env.EMAIL_FROM || `Hoppers <${user}>`,
  };
}

function sanitizeMailHeader(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function emailAddressFromHeader(value) {
  const text = sanitizeMailHeader(value);
  const bracketed = text.match(/<([^<>]+)>/);
  return (bracketed ? bracketed[1] : text).trim();
}

function createSmtpReader(socket) {
  let buffer = "";
  let current = [];
  const responses = [];
  const waiters = [];

  function flushWaiter() {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(responses.shift());
  }

  socket.on("data", (chunk) => {
    buffer += chunk;
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd >= 0) {
      const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
      buffer = buffer.slice(lineEnd + 1);
      current.push(line);
      if (/^\d{3}(?:\s|$)/.test(line)) {
        responses.push(current.join("\n"));
        current = [];
        flushWaiter();
      }
      lineEnd = buffer.indexOf("\n");
    }
  });

  socket.on("error", (error) => {
    while (waiters.length) waiters.shift().reject(error);
  });

  socket.on("close", () => {
    while (waiters.length) waiters.shift().reject(new Error("SMTP connection closed before the mail server responded"));
  });

  return function readResponse() {
    if (responses.length) return Promise.resolve(responses.shift());
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  };
}

async function smtpCommand(socket, readResponse, command, expectedCodes) {
  socket.write(`${command}\r\n`);
  const response = await readResponse();
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP rejected ${command.split(" ")[0]}: ${response}`);
  }
  return response;
}

function dotStuff(body) {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

async function sendSmtpEmail({ to, subject, body }) {
  const settings = smtpSettings();
  if (!settings) return null;

  const socket = await new Promise((resolve, reject) => {
    const client = tls.connect(
      {
        host: settings.host,
        port: settings.port,
        servername: settings.host,
        rejectUnauthorized: true,
      },
      () => resolve(client)
    );
    client.once("error", reject);
    client.setTimeout(15000, () => client.destroy(new Error("SMTP connection timed out")));
  });

  const readResponse = createSmtpReader(socket);
  const fromAddress = emailAddressFromHeader(settings.from);
  const messageId = `<${crypto.randomUUID()}@hhopperr.com>`;
  const headers = [
    `From: ${sanitizeMailHeader(settings.from)}`,
    `To: ${sanitizeMailHeader(to)}`,
    `Subject: ${sanitizeMailHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
  ].join("\r\n");

  try {
    const greeting = await readResponse();
    if (Number(greeting.slice(0, 3)) !== 220) throw new Error(`SMTP greeting failed: ${greeting}`);
    await smtpCommand(socket, readResponse, "EHLO hhopperr.com", [250]);
    await smtpCommand(
      socket,
      readResponse,
      `AUTH PLAIN ${Buffer.from(`\u0000${settings.user}\u0000${settings.pass}`).toString("base64")}`,
      [235]
    );
    await smtpCommand(socket, readResponse, `MAIL FROM:<${fromAddress}>`, [250]);
    await smtpCommand(socket, readResponse, `RCPT TO:<${emailAddressFromHeader(to)}>`, [250, 251]);
    await smtpCommand(socket, readResponse, "DATA", [354]);
    socket.write(`${headers}\r\n\r\n${dotStuff(body)}\r\n.\r\n`);
    const dataResponse = await readResponse();
    if (Number(dataResponse.slice(0, 3)) !== 250) throw new Error(`SMTP rejected message: ${dataResponse}`);
    await smtpCommand(socket, readResponse, "QUIT", [221]);
    return { id: messageId, provider: "smtp" };
  } finally {
    socket.end();
  }
}

if (smtpSettings() && !process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = "hoppers-smtp-bridge";
}

const originalFetch = global.fetch;

global.fetch = async function hoppersFetch(url, options = {}) {
  if (String(url).startsWith("https://api.resend.com/emails") && process.env.RESEND_API_KEY === "hoppers-smtp-bridge") {
    const payload = JSON.parse(options.body || "{}");
    await sendSmtpEmail({
      to: Array.isArray(payload.to) ? payload.to[0] : payload.to,
      subject: payload.subject,
      body: payload.text || payload.html || "",
    });
    return new Response(JSON.stringify({ id: `smtp_${crypto.randomUUID()}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return originalFetch(url, options);
};

const handleRequest = require("../server.js");

module.exports = function hoppersApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if ((url.pathname === "/api/health" || url.pathname === "/api/status") && smtpSettings()) {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        storage: process.env.SUPABASE_URL ? "supabase" : "local-json",
        accountStorage: process.env.SUPABASE_URL ? "supabase-permanent" : "local-json-dev",
        payments: process.env.STRIPE_SECRET_KEY ? "stripe" : "pre-stripe",
        email: "smtp",
      })
    );
    return;
  }
  return handleRequest(req, res);
};
