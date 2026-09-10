// Minimal shape of the `window.Razorpay` constructor injected by checkout.js.
// Only the fields this app actually uses are typed — the SDK exposes more.
// Subscription mode: no `amount`/`currency` — those come from the Plan
// linked to `subscription_id`, and the success handler hands back
// `razorpay_subscription_id` instead of `razorpay_order_id`.
export interface RazorpayCheckoutOptions {
  key: string;
  name: string;
  description?: string;
  subscription_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loadPromise: Promise<void> | null = null;

/**
 * Loads the Razorpay Standard Checkout script on demand (not on every page
 * load — only when someone actually opens the billing/checkout flow).
 * Safe to call repeatedly; the script is only injected once.
 */
export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Razorpay checkout script'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
