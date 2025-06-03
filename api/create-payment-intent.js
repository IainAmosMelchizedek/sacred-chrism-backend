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
    const { customer_email, user_name } = req.body;

    console.log('🔄 Creating payment intent for:', customer_email);

    // Validate required fields
    if (!customer_email) {
      return res.status(400).json({ error: 'Customer email is required' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1111, // $11.11 in cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        customer_email: customer_email,
        user_name: user_name || 'Anonymous',
        product_type: 'sacred_text_pdf',
        purchase_timestamp: new Date().toISOString()
      },
      receipt_email: customer_email,
      description: 'God-Man: The Word Made Flesh - Sacred Text PDF'
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    // Return client secret for frontend
    res.status(200).json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    });

  } catch (error) {
    console.error('❌ Payment intent creation failed:', error);
    res.status(500).json({ 
      error: 'Payment intent creation failed',
      message: error.message 
    });
  }
}
