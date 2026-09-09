// Client-facing bundle tiers. Only resale pricing lives here - wholesale
// cost is never shown outside the admin panel.
//
// Edit freely: this is placeholder pricing meant to be replaced with real
// numbers once you know your actual wholesale costs and margins.

module.exports = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Solo operator, testing the water',
    priceLabel: '$38–$55',
    priceUnit: 'per lead',
    volume: 'Up to 15 leads / month',
    features: [
      'Pay-as-you-go, no monthly minimum',
      '1 coverage area',
      'Lockout, rekey, and auto job types',
      'Leads delivered to your dashboard in real time',
    ],
  },
  {
    id: 'crew',
    name: 'Crew',
    tagline: 'For a shop running 2–4 techs',
    priceLabel: '$32–$48',
    priceUnit: 'per lead',
    volume: '15–50 leads / month',
    features: [
      'Everything in Starter',
      'Up to 2 coverage areas',
      'Priority placement in queue order',
      'Monthly activity summary',
    ],
    featured: true,
  },
  {
    id: 'fleet',
    name: 'Fleet',
    tagline: 'Multi-truck operations at scale',
    priceLabel: 'Custom',
    priceUnit: 'volume pricing',
    volume: '50+ leads / month',
    features: [
      'Everything in Crew',
      'Unlimited coverage areas',
      'Dedicated account contact',
      'Custom job-type filtering',
    ],
  },
];
