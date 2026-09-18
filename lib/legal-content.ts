/**
 * In-app v1 Terms of Service and Privacy Policy. Drafted from actual
 * Send2U behavior only: campus food requests fulfilled by fellow students
 * with Send2U-managed transactions (simulated online payment or cash on
 * delivery), cafeteria preparation, and helper delivery. Review with the
 * Send2U team before any production release.
 */

export interface LegalSection {
  heading: string;
  body: string[];
}

export const TERMS_OF_SERVICE: LegalSection[] = [
  {
    heading: 'What Send2U does',
    body: [
      'Send2U connects students on campus: requesters order food from campus stalls, cafeterias prepare it, and helpers deliver it. Send2U records and manages every transaction. Send2U does not prepare food and does not employ delivery staff.',
    ],
  },
  {
    heading: 'Requests',
    body: [
      'A request lists dishes from one stall plus a campus drop-off point and a payment method (Online Payment or Cash on Delivery). You may cancel a request while the kitchen has not committed to it; cancelled requests stay in your history. Availability shown in the app comes from the stalls and helpers. Send2U cannot guarantee an item stays available after you submit.',
    ],
  },
  {
    heading: 'Delivery and confirmation',
    body: [
      'Helpers collect your Send2U-covered food from the stall and bring it to your chosen drop-off point — they never pay for your food with their own money. When a request is marked delivered, check your items and confirm receipt in the app. Confirm only food you actually received.',
    ],
  },
  {
    heading: 'Payment',
    body: [
      'At checkout you choose Online Payment (pay in Send2U, simulated for this demo — no real money moves) or Cash on Delivery (pay the full total in cash to your helper on arrival; the helper records the collection). There are no helper QR transfers and no receipt uploads. Online payments that fail can be retried without double charging. Send2U stores no bank or card details.',
    ],
  },
  {
    heading: 'Problems and disputes',
    body: [
      'If a delivered request has a problem, report it in the app before confirming. Reporting moves the request to Disputed for review. Online payments on orders cancelled before completion are recorded as refunded (simulated for this demo).',
    ],
  },
  {
    heading: 'Accounts',
    body: [
      'You sign in with your email and password. Your role is permanent for the account. You are responsible for keeping your password private and for activity under your account.',
    ],
  },
  {
    heading: 'Fair use',
    body: [
      'Use Send2U only for genuine campus food requests. Do not submit false reports, abuse helpers or stalls, or attempt to disrupt the service. Accounts that misuse the service may be restricted.',
    ],
  },
];

export const PRIVACY_POLICY: LegalSection[] = [
  {
    heading: 'What we collect',
    body: [
      'Your account email and sign-in credentials. The profile details you choose to add: full name, student ID, phone number, and profile photo.',
      'Your requests: dishes, stall, drop-off point, payment method, status history, transaction and settlement records, ratings you give, and issue reports you file.',
    ],
  },
  {
    heading: 'What we do not collect',
    body: [
      'No bank, card, or payment credentials — online payments in this demo are simulated and cash is handed over in person. No location tracking: drop-off points are fixed campus locations you pick per request.',
    ],
  },
  {
    heading: 'How your data is used',
    body: [
      'To run the service: match requests with helpers, show order status, record platform transactions and settlements, and review disputes.',
      'To keep accounts secure and prevent misuse. Your data is never sold and never used for advertising.',
    ],
  },
  {
    heading: 'Who can see it',
    body: [
      'Helpers working on your request see its dishes, drop-off point, and payment method. Stalls see their own orders (items, payment state, preparation status). Your email and phone number are never shown to other users.',
    ],
  },
  {
    heading: 'Storage and security',
    body: [
      'Data is stored with access rules that limit every user to their own records. Profile photos are stored privately and shared only through short-lived links inside the app.',
    ],
  },
  {
    heading: 'Your control',
    body: [
      'You can update your profile details and photo in Edit Profile, and change your password in Settings. Signing out ends your session on that device.',
    ],
  },
];
