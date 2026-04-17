const notificationStore = globalThis.__medconnectNotificationStore ?? {
  deliveries: [],
};

if (!globalThis.__medconnectNotificationStore) {
  globalThis.__medconnectNotificationStore = notificationStore;
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

function maskEmail(email) {
  if (!email || !String(email).includes("@")) return email;
  const [localPart, domain] = String(email).split("@");
  if (localPart.length <= 2) return `${localPart[0] || "*"}***@${domain}`;
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("91") && digits.length === 12 ? `+${digits}` : `+${digits}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMultilineHtml(text) {
  return escapeHtml(text).replaceAll("\n", "<br />");
}

function getNotificationConfig() {
  const twilioConfigured =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID);

  const fast2SmsConfigured = Boolean(process.env.FAST2SMS_API_KEY);
  const resendConfigured =
    Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.CREDENTIALS_EMAIL_FROM);

  return {
    sms: {
      ready: twilioConfigured || fast2SmsConfigured,
      provider: twilioConfigured ? "twilio" : fast2SmsConfigured ? "fast2sms" : null,
      missing:
        twilioConfigured || fast2SmsConfigured
          ? []
          : [
              "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER",
              "or FAST2SMS_API_KEY",
            ],
    },
    email: {
      ready: resendConfigured,
      provider: resendConfigured ? "resend" : null,
      missing: resendConfigured ? [] : ["RESEND_API_KEY", "CREDENTIALS_EMAIL_FROM"],
    },
  };
}

function buildPatientMessage({ patient }) {
  const subject = `Patient portal credentials for ${patient.full_name}`;
  const text = [
    `Patient portal access for ${patient.full_name}`,
    `Patient ID: ${patient.patient_id}`,
    `Temporary password: ${patient.password}`,
    `Ward: ${patient.ward}`,
    `Bed: ${patient.bed_number}`,
    "",
    "Please sign in and update the credentials after first access.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#0891b2">JeevaDrishti 360</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Patient portal credentials</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569">Access details for ${escapeHtml(patient.full_name)} are ready.</p>
        <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;background:#f8fafc">
          <p style="margin:0 0 8px"><strong>Patient ID:</strong> ${escapeHtml(patient.patient_id)}</p>
          <p style="margin:0 0 8px"><strong>Temporary password:</strong> ${escapeHtml(patient.password)}</p>
          <p style="margin:0"><strong>Care location:</strong> ${escapeHtml(patient.ward)} / Bed ${escapeHtml(patient.bed_number)}</p>
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#64748b">Please sign in and update the credentials after first access.</p>
      </div>
    </div>
  `;

  return { subject, text, html };
}

function buildStaffMessage({ staff }) {
  const subject = `Staff onboarding credentials for ${staff.name}`;
  const text = [
    `Staff access has been created for ${staff.name}.`,
    `Employee ID: ${staff.employee_id}`,
    `Role: ${staff.role}`,
    `Department: ${staff.department || "Assigned Department"}`,
    `Setup link: ${staff.setup_link}`,
    "",
    "Open the setup link to create the first password.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#0f766e">JeevaDrishti 360</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Staff onboarding details</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569">Your hospital access package is ready.</p>
        <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;background:#f8fafc">
          <p style="margin:0 0 8px"><strong>Employee ID:</strong> ${escapeHtml(staff.employee_id)}</p>
          <p style="margin:0 0 8px"><strong>Role:</strong> ${escapeHtml(staff.role)}</p>
          <p style="margin:0 0 8px"><strong>Department:</strong> ${escapeHtml(staff.department || "Assigned Department")}</p>
          <p style="margin:0"><strong>Setup link:</strong> <a href="${escapeHtml(staff.setup_link)}">${escapeHtml(staff.setup_link)}</a></p>
        </div>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#64748b">Open the setup link to create your first password.</p>
      </div>
    </div>
  `;

  return { subject, text, html };
}

async function sendViaTwilio({ to, body, channel }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  const targetTo =
    channel === "whatsapp" && !String(to).startsWith("whatsapp:")
      ? `whatsapp:${to}`
      : to;
  const targetFrom =
    channel === "whatsapp"
      ? whatsappFrom || (fromNumber ? `whatsapp:${fromNumber}` : "")
      : fromNumber;

  const payload = new URLSearchParams({
    To: targetTo,
    Body: body,
  });

  if (channel === "sms" && messagingServiceSid) {
    payload.set("MessagingServiceSid", messagingServiceSid);
  } else {
    payload.set("From", targetFrom);
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Twilio send failed");
  }

  return {
    provider: "twilio",
    external_id: result.sid,
    status: result.status || "queued",
  };
}

async function sendViaFast2Sms({ to, body }) {
  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: process.env.FAST2SMS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "v3",
      language: "english",
      flash: 0,
      numbers: String(to).replace(/^\+/, ""),
      message: body,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.return === false) {
    throw new Error(result.message || result?.errors?.[0]?.message || "Fast2SMS send failed");
  }

  return {
    provider: "fast2sms",
    external_id: result.request_id || result.message_id || null,
    status: "sent",
  };
}

async function sendEmail({ to, subject, text, html, idempotencyKey }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.CREDENTIALS_EMAIL_FROM,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.message || result?.error || "Resend email send failed");
  }

  return {
    provider: "resend",
    external_id: result.id,
    status: "sent",
  };
}

async function sendSms({ to, body, contactMode }) {
  const config = getNotificationConfig();
  if (!config.sms.ready) {
    throw new Error(`SMS provider not configured. Missing: ${config.sms.missing.join(", ")}`);
  }

  const channel = String(contactMode || "").toLowerCase().includes("whatsapp") ? "whatsapp" : "sms";
  const normalizedTo = normalizePhone(to);

  if (config.sms.provider === "twilio") {
    return sendViaTwilio({ to: normalizedTo, body, channel });
  }

  return sendViaFast2Sms({ to: normalizedTo, body });
}

function buildDeliverySummary(channelResults) {
  const sent = channelResults.filter((result) => result.status === "sent" || result.status === "queued");
  const failed = channelResults.filter((result) => result.status === "failed");
  const skipped = channelResults.filter((result) => result.status === "skipped");

  return {
    status:
      sent.length === channelResults.length && sent.length > 0
        ? "sent"
        : sent.length > 0
          ? "partial"
          : failed.length > 0
            ? "failed"
            : "skipped",
    sent_count: sent.length,
    failed_count: failed.length,
    skipped_count: skipped.length,
  };
}

function recordDelivery({ audienceType, recipientName, recipientId, phone, email, results }) {
  const summary = buildDeliverySummary(results);
  const record = {
    id: `notify-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
    audience_type: audienceType,
    recipient_id: recipientId,
    recipient_name: recipientName,
    phone: phone ? maskPhone(phone) : null,
    email: email ? maskEmail(email) : null,
    status: summary.status,
    channels: results,
  };

  notificationStore.deliveries.unshift(record);
  notificationStore.deliveries = notificationStore.deliveries.slice(0, 25);

  return {
    ...summary,
    channels: results,
    contact_phone: record.phone,
    contact_email: record.email,
  };
}

async function dispatchCredentialNotification({
  audienceType,
  recipientName,
  recipientId,
  contactPhone,
  contactEmail,
  contactMode,
  message,
}) {
  const results = [];
  const smsText = message.text;
  const idempotencyKey = `${audienceType}-${recipientId}`;

  if (contactPhone) {
    try {
      const smsResult = await sendSms({
        to: contactPhone,
        body: smsText,
        contactMode,
      });
      results.push({
        channel: String(contactMode || "").toLowerCase().includes("whatsapp") ? "whatsapp" : "sms",
        status: smsResult.status === "queued" ? "queued" : "sent",
        provider: smsResult.provider,
        external_id: smsResult.external_id,
      });
    } catch (error) {
      results.push({
        channel: String(contactMode || "").toLowerCase().includes("whatsapp") ? "whatsapp" : "sms",
        status: "failed",
        provider: getNotificationConfig().sms.provider || "unconfigured",
        error: error.message,
      });
    }
  } else {
    results.push({
      channel: "sms",
      status: "skipped",
      provider: null,
      error: "No phone number supplied",
    });
  }

  if (contactEmail) {
    try {
      const emailResult = await sendEmail({
        to: contactEmail,
        subject: message.subject,
        text: message.text,
        html: message.html,
        idempotencyKey: `${idempotencyKey}-email`,
      });
      results.push({
        channel: "email",
        status: "sent",
        provider: emailResult.provider,
        external_id: emailResult.external_id,
      });
    } catch (error) {
      results.push({
        channel: "email",
        status: "failed",
        provider: getNotificationConfig().email.provider || "unconfigured",
        error: error.message,
      });
    }
  } else {
    results.push({
      channel: "email",
      status: "skipped",
      provider: null,
      error: "No email address supplied",
    });
  }

  return recordDelivery({
    audienceType,
    recipientName,
    recipientId,
    phone: contactPhone,
    email: contactEmail,
    results,
  });
}

export async function dispatchPatientCredentials({
  patient,
  contactPhone,
  contactEmail,
  contactMode,
}) {
  return dispatchCredentialNotification({
    audienceType: "patient",
    recipientName: patient.full_name,
    recipientId: patient.patient_id,
    contactPhone,
    contactEmail,
    contactMode,
    message: buildPatientMessage({ patient }),
  });
}

export async function dispatchStaffCredentials({
  staff,
  contactPhone,
  contactEmail,
  contactMode,
}) {
  return dispatchCredentialNotification({
    audienceType: "staff",
    recipientName: staff.name,
    recipientId: staff.employee_id,
    contactPhone,
    contactEmail,
    contactMode,
    message: buildStaffMessage({ staff }),
  });
}

export function getNotificationDeliveries() {
  return notificationStore.deliveries;
}

export function getNotificationHealth() {
  return getNotificationConfig();
}
