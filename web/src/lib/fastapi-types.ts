export type BetterAuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export type AccountEntitlement = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
  entitlement: {
    plan: string;
    credits: number;
    daily_usage_count: number;
    subscription_status: string;
    provider_customer_id: string | null;
    provider_subscription_id: string | null;
    current_period_end: string | null;
  };
};
