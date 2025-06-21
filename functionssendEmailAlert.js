// ✅ sendEmailAlert.js – Send email when user favorites a stock
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendFavoriteAlert(email, symbol) {
  const msg = {
    to: email,
    from: 'alerts@stock100.app', // Must be verified in SendGrid
    subject: `⭐ You Favorited ${symbol} on Stock100`,
    text: `You just favorited ${symbol}. We’ll keep you updated on major changes.`,
    html: `<strong>You just favorited <span style="color:green">${symbol}</span>.<br>We’ll keep you posted!</strong>`
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 Email sent to ${email} for ${symbol}`);
  } catch (err) {
    console.error('❌ Email send failed:', err.response?.body || err);
  }
}

module.exports = { sendFavoriteAlert };
