import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export function otpEmailTemplate(name: string, otp: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
      <h2 style="color: #111827; margin-bottom: 8px;">AutoFlow AI</h2>
      <p style="color: #374151;">Hi ${name},</p>
      <p style="color: #374151;">Your verification code is:</p>
      <div style="background: #111827; color: #fff; font-size: 32px; letter-spacing: 8px; text-align: center; padding: 16px; border-radius: 8px; margin: 24px 0;">
        ${otp}
      </div>
      <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. Do not share it with anyone.</p>
    </div>
  `;
}

export function resetPasswordEmailTemplate(name: string, resetLink: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
      <h2 style="color: #111827; margin-bottom: 8px;">AutoFlow AI</h2>
      <p style="color: #374151;">Hi ${name},</p>
      <p style="color: #374151;">We received a request to reset your password. Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetLink}" style="background: #111827; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">Or copy this link: ${resetLink}</p>
    </div>
  `;
}
