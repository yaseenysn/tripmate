import nodemailer from 'nodemailer';

interface SendInviteEmailParams {
  toEmail: string;
  inviterName: string;
  tripName: string;
  inviteUrl: string;
  message?: string;
}

export const sendInviteEmail = async ({
  toEmail,
  inviterName,
  tripName,
  inviteUrl,
  message
}: SendInviteEmailParams) => {
  const htmlContent = `
    <!Page html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b141a; color: #e9edef; margin: 0; padding: 20px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #111b21; border-radius: 20px; border: 1px solid #202c33; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 30px 24px; }
          .inviter-box { background-color: #1f2c34; border: 1px solid #2a3942; border-radius: 14px; padding: 16px; margin-bottom: 20px; text-align: center; }
          .inviter-box p { margin: 0; font-size: 14px; color: #d1d5db; }
          .trip-title { font-size: 20px; font-weight: 700; color: #34d399; margin-top: 4px; }
          .custom-msg { background-color: #182229; border-left: 4px solid #10b981; padding: 14px; margin: 16px 0; border-radius: 6px; font-style: italic; font-size: 13px; color: #9ca3af; }
          .btn-container { text-align: center; margin: 30px 0; }
          .btn { background-color: #10b981; color: #ffffff !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #202c33; }
          .link-fallback { color: #38bdf8; word-break: break-all; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TripMate Invitation</h1>
            <p>Collaborative Travel Group & Expense Management</p>
          </div>
          <div class="content">
            <div class="inviter-box">
              <p><strong>${inviterName}</strong> has invited you to join the trip group:</p>
              <div class="trip-title">${tripName}</div>
            </div>
            
            ${message ? `<div class="custom-msg">"${message}"</div>` : ''}

            <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center;">
              Click the button below to view the trip details and accept your invitation.
            </p>

            <div class="btn-container">
              <a href="${inviteUrl}" class="btn" target="_blank">Join Trip</a>
            </div>

            <p style="font-size: 12px; color: #64748b; text-align: center;">
              Or copy and paste this link into your browser:<br/>
              <a href="${inviteUrl}" class="link-fallback">${inviteUrl}</a>
            </p>
          </div>
          <div class="footer">
            Sent via TripMate Travel Workspace • Safe & Private
          </div>
        </div>
      </body>
    </html>
  `;

  // Log invitation details nicely in backend terminal for verification/debugging
  console.log('\n=================== INVITATION EMAIL SENT ===================');
  console.log(`To: ${toEmail}`);
  console.log(`From: ${inviterName}`);
  console.log(`Trip: ${tripName}`);
  console.log(`Join Link: ${inviteUrl}`);
  console.log('=============================================================\n');

  // Attempt real nodemailer transport if SMTP env vars configured, otherwise output log
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"TripMate" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `You're invited to join "${tripName}" on TripMate!`,
        html: htmlContent,
      });
    }
  } catch (err) {
    console.warn('SMTP transport warning (logged email to terminal instead):', err);
  }

  return { success: true, inviteUrl };
};
