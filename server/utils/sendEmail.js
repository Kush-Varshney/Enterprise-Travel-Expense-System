const nodemailer = require('nodemailer')

// Validate SMTP config at startup
const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']
const missing = requiredEnv.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(`Missing SMTP config: ${missing.join(', ')}`)
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

function getEmailTemplate({ subject, body }) {
  return `
    <div style="font-family: 'Segoe UI', 'Roboto', Arial, sans-serif; background: #f8fafc; padding: 32px; color: #222;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); overflow: hidden;">
        <div style="background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%); padding: 24px 32px;">
          <h1 style="color: #fff; font-size: 1.5rem; margin: 0;">Travel & Expense Management</h1>
        </div>
        <div style="padding: 32px;">
          <h2 style="font-size: 1.2rem; color: #6366f1; margin-top: 0;">${subject}</h2>
          <div style="font-size: 1rem; color: #222; margin: 24px 0; line-height: 1.7;">
            ${body}
          </div>
          <div style="margin-top: 32px; font-size: 0.95rem; color: #555;">
            Regards,<br/>
            <strong>Travel & Expense Management Team</strong><br/>
            <span style="color: #888; font-size: 0.9em;">This is an automated message. Please do not reply directly to this email.</span>
          </div>
        </div>
      </div>
    </div>
  `
}

function getPlainText({ subject, body }) {
  return `${subject}\n\n${body}\n\nRegards,\nTravel & Expense Management Team\n(This is an automated message. Please do not reply.)`
}

async function sendEmail({ to, subject, text, html, body }) {
  // If body is provided, generate html and text from template
  let htmlContent = html
  let textContent = text
  if (body) {
    htmlContent = getEmailTemplate({ subject, body })
    textContent = getPlainText({ subject, body })
  }
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text: textContent,
    html: htmlContent,
  })
}

module.exports = sendEmail 