// إرسال الإيميلات عن طريق Gmail
import nodemailer from 'nodemailer';
import { env } from './util.mjs';

let transporter;

export async function sendMail(to, subject, html) {
  transporter ||= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: env('GMAIL_USER'), pass: env('GMAIL_APP_PASSWORD') }
  });
  await transporter.sendMail({
    from: `"ذكّرني" <${env('GMAIL_USER')}>`,
    to,
    subject,
    html
  });
}

export const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// قالب الإيميل الفخم
export function layout(title, body) {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><body style="margin:0;background:#07060d;font-family:Tahoma,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07060d;padding:30px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#14112a;border:1px solid #2c2650;border-radius:20px;overflow:hidden">
      <tr><td style="background:linear-gradient(135deg,#8b5cf6,#ec4899);padding:22px;text-align:center">
        <div style="font-size:30px;font-weight:900;color:#fff">🔔 ذكّرني</div>
      </td></tr>
      <tr><td style="padding:28px 26px;color:#f4f1ff;text-align:right">
        <div style="font-size:20px;font-weight:800;margin-bottom:14px">${title}</div>
        ${body}
      </td></tr>
      <tr><td style="padding:14px;text-align:center;color:#6d6885;font-size:12px;border-top:1px solid #2c2650">لا كويز يفوتك، ولا تاسك يضيع منك.</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export const fmtDate = ts => new Intl.DateTimeFormat('ar-u-nu-latn', {
  weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
  timeZone: env('TZ_NAME') || 'Asia/Riyadh'
}).format(ts);
