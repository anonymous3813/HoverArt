import nodemailer from 'nodemailer';

export async function sendCanvasEmail({ to, imageData, message }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file.'
    );
  }

  const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
  const port = parseInt(SMTP_PORT ?? '587');

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  const htmlBody = `
    <div style="background:#07070d;padding:32px;font-family:monospace;color:#e0e0e8;border-radius:12px;max-width:640px;margin:0 auto;">
      <h2 style="color:#00f5ff;margin:0 0 8px;">Someone shared a HoverArt drawing with you</h2>
      ${message ? `<p style="color:#aaa;margin:0 0 24px;">${message}</p>` : ''}
      <img src="cid:canvas-image" style="width:100%;border-radius:8px;border:1px solid #ffffff15;" alt="HoverArt drawing" />
      <p style="color:#ffffff30;font-size:11px;margin:16px 0 0;">Created with HoverArt — draw with your hands, no touch required.</p>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to,
    subject: 'Someone shared a HoverArt drawing with you \u270f',
    html: htmlBody,
    attachments: [{
      filename: 'hoverart.png',
      content: base64Data,
      encoding: 'base64',
      cid: 'canvas-image'
    }]
  });
}
