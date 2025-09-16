// utils/subscriptions.ts
import { useEffect, useState } from 'react';

// Flip this to true once RevenueCat is wired
const USE_MOCK = true;

type Offering = { identifier: string; priceString: string };
type Offerings = { monthly?: Offering; annual?: Offering };

export function usePro() {
  const [loading, setLoading] = useState(false);
  const [hasPro, setHasPro] = useState(false);
  const [offerings, setOfferings] = useState<Offerings | null>(null);

  useEffect(() => {
    if (USE_MOCK) {
      setOfferings({
        monthly: { identifier: 'lp_plus_monthly', priceString: '€2.99' },
        annual: { identifier: 'lp_plus_annual', priceString: '€19.99' },
      });
      return;
    }
    // TODO: RevenueCat SDK fetch offerings & active entitlement
  }, []);

  return { loading, hasPro, setHasPro, offerings };
}

export async function purchase(o: Offering) {
  if (USE_MOCK) {
    // Do nothing – show a toast in your app when you call purchase()
    return;
  }
  // TODO: RevenueCat purchase flow
}
