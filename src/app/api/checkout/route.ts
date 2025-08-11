export const runtime = 'nodejs';
export async function POST(req: Request) {
  try {
    const { amount } = await req.json();
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ checkoutUrl: null, unlocked: true }), { status: 200 });
    }
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price_data:{ currency:'usd', unit_amount: amount, product_data:{ name:'NYC HS Guide (PWYW)' }}, quantity:1 }],
      metadata: { pwyw: 'true' },
      success_url: `${baseUrl}/api/checkout/success`,
      cancel_url: `${baseUrl}/?canceled=1`,
    });
    return new Response(JSON.stringify({ checkoutUrl: session.url }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'checkout_error' }), { status: 500 });
  }
}
