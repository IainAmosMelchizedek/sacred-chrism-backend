const Stripe = require('stripe');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');

// Initialize services
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Microsoft Graph API configuration
const MICROSOFT_CONFIG = {
  clientId: process.env.MICROSOFT_CLIENT_ID || '7b461fde-c19f-4334-b1e6-59668f91dd3a',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  tenantId: process.env.MICROSOFT_TENANT_ID || '13facd1e-c246-4d57-b296-e7ca8774c765'
};

// Get Microsoft Graph access token
async function getMicrosoftToken() {
  try {
    const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_CONFIG.tenantId}/oauth2/v2.0/token`;
    
    const tokenData = new URLSearchParams({
      client_id: MICROSOFT_CONFIG.clientId,
      client_secret: MICROSOFT_CONFIG.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    const response = await axios.post(tokenUrl, tokenData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('❌ Microsoft token error:', error.response?.data || error.message);
    throw error;
  }
}

// Get PDF file from OneDrive
async function getPDFFile(accessToken) {
  try {
    const fileUrl = `https://graph.microsoft.com/v1.0/users/${process.env.MICROSOFT_USER_EMAIL || 'your-email@domain.com'}/drive/root:/Documents/God-Man: The Word Made Flesh.pdf`;
    
    const response = await axios.get(fileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return response.data;
  } catch (error) {
    console.error('❌ PDF file error:', error.response?.data || error.message);
    throw error;
  }
}

// Create shareable link for PDF
async function createShareableLink(accessToken, fileId) {
  try {
    const shareUrl = `https://graph.microsoft.com/v1.0/users/${process.env.MICROSOFT_USER_EMAIL || 'your-email@domain.com'}/drive/items/${fileId}/createLink`;
    
    const shareData = {
      type: 'view',
      scope: 'anonymous',
      expirationDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    const response = await axios.post(shareUrl, shareData, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.link;
  } catch (error) {
    console.error('❌ Share link error:', error.response?.data || error.message);
    throw error;
  }
}

// Send PDF email via SendGrid
async function sendPDFEmail(customerEmail, downloadLink, customerName = 'Seeker') {
  try {
    const emailData = {
      to: customerEmail,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@sacredchrism.app',
        name: 'Sacred Chrism'
      },
      subject: '✨ Your Sacred Text: God-Man: The Word Made Flesh',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .download-btn { display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🙏 Thank You, ${customerName}!</h1>
            <p>Your sacred journey begins now</p>
          </div>
          
          <div class="content">
            <h2>Your Sacred Text is Ready</h2>
            <p>Thank you for your purchase of <strong>"God-Man: The Word Made Flesh"</strong> by George W. Carey.</p>
            
            <p>This profound text reveals the ancient wisdom that inspired the Sacred Chrism app - the divine science of spiritual regeneration through understanding your body's sacred rhythms.</p>
            
            <div style="text-align: center;">
              <a href="${downloadLink}" class="download-btn">📖 Download Your Sacred Text</a>
            </div>
            
            <p><strong>Important:</strong> This download link expires in 7 days for security. Please download and save the PDF to your device.</p>
            
            <p>May this ancient wisdom illuminate your path to spiritual awakening and divine consciousness.</p>
            
            <p>In sacred service,<br>
            <strong>The Sacred Chrism Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This email was sent because you purchased the Sacred Text through our Sacred Chrism application.</p>
            <p>If you need assistance, please reply to this email.</p>
          </div>
        </body>
        </html>
      `
    };

    await sgMail.send(emailData);
    console.log('✅ Email sent successfully to:', customerEmail);
    return { success: true };

  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw error;
  }
}

// Main webhook handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook signature verified:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle payment success
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const customerEmail = paymentIntent.metadata.customer_email;
    const customerName = paymentIntent.metadata.user_name;

    console.log('🎉 Payment succeeded for:', customerEmail);

    try {
      // Step 1: Get Microsoft Graph access token
      console.log('🔑 Getting Microsoft access token...');
      const accessToken = await getMicrosoftToken();

      // Step 2: Get PDF file from OneDrive
      console.log('📁 Getting PDF from OneDrive...');
      const pdfFile = await getPDFFile(accessToken);

      // Step 3: Create shareable link
      console.log('🔗 Creating shareable link...');
      const shareableLink = await createShareableLink(accessToken, pdfFile.id);

      // Step 4: Send email with download link
      console.log('📧 Sending email to customer...');
      await sendPDFEmail(customerEmail, shareableLink.webUrl, customerName);

      console.log('✅ Complete process successful for:', customerEmail);

    } catch (error) {
      console.error('❌ PDF delivery failed:', error);
      // Could implement retry logic or admin notification here
    }
  }

  res.status(200).json({ received: true });
}
