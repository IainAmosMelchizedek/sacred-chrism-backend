const Stripe = require('stripe');

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Set CORS headers for frontend access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customer_email, user_name, success_url, cancel_url } = req.body;

    console.log('🔄 Creating Stripe Checkout session for:', customer_email);

    // Validate required fields
    if (!customer_email) {
      return res.status(400).json({ error: 'Customer email is required' });
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customer_email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID || 'price_1RVeWBDB6tPzmgURZtjS4YKx',
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url || 'https://your-domain.com/success',
      cancel_url: cancel_url || 'https://your-domain.com/cancel',
      metadata: {
        customer_email: customer_email,
        user_name: user_name || 'Anonymous',
        product_type: 'sacred_text_pdf',
        purchase_timestamp: new Date().toISOString()
      },
      payment_intent_data: {
        metadata: {
          customer_email: customer_email,
          user_name: user_name || 'Anonymous',
          product_type: 'sacred_text_pdf'
        }
      }
    });

    console.log('✅ Checkout session created:', session.id);

    // Return checkout URL for frontend redirect
    res.status(200).json({
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error) {
    console.error('❌ Checkout session creation failed:', error);
    res.status(500).json({ 
      error: 'Checkout session creation failed',
      message: error.message 
    });
  }
}
