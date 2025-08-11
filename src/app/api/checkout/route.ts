export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();

    // $0 or missing amount -> unlock without Stripe
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ checkoutUrl: null, unlocked: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const Stripe = (await import('stripe')).default;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return new Response(
        JSON.stringify({ error: 'missing_stripe_key' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Do NOT pass apiVersion here; let the SDK use your account's default.
    const stripe = new Stripe(secret);

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: { name: 'NYC HS Guide (PWYW)' },
          },
          quantity: 1,
        },
      ],
      metadata: { pwyw: 'true' },
      success_url: `${baseUrl}/api/checkout/success`,
      cancel_url: `${baseUrl}/?canceled=1`,
    });

    return new Response(
      JSON.stringify({ checkoutUrl: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'checkout_error', message: String((err as Error)?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
