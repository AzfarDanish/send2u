/**
 * In-app v1 Terms of Service and Privacy Policy. Drafted from actual
 * Send2U behavior only: campus food requests fulfilled by fellow
 * students, external payment with in-app receipts, manual dispute
 * settlement. Review with the Send2U team before any production release.
 */

export interface LegalSection {
  heading: string;
  body: string[];
}

export const TERMS_OF_SERVICE: LegalSection[] = [
  {
    heading: 'What Send2U does',
    body: [
      'Send2U connects students on campus: requesters ask for food from campus stalls, and helpers buy and deliver it for them. Send2U does not prepare food and does not employ delivery staff.',
    ],
  },
  {
    heading: 'Requests',
    body: [
      'A request lists dishes from one stall plus a campus drop-off point. You may cancel a request while no helper has accepted it. Once a helper accepts, the request is committed and can no longer be cancelled from the app.',
      'Availability shown in the app comes from the stalls and helpers. Send2U cannot guarantee an item stays available after you submit.',
    ],
  },
  {
    heading: 'Delivery and confirmation',
    body: [
      'Helpers buy your food upfront and bring it to your chosen drop-off point. When a request is marked delivered, check your items and confirm receipt in the app. Confirm only food you actually received — confirmation opens payment.',
    ],
  },
  {
    heading: 'Payment',
    body: [
      'Payment happens outside the app through the helper’s payment QR code. After confirming receipt, pay the exact total and attach your receipt in the request so the helper can verify it.',
      'Send2U never touches your money and stores no bank or card details.',
    ],
  },
  {
    heading: 'Problems and disputes',
    body: [
      'If a delivered request has a problem, report it in the app before confirming. Reporting moves the request to Disputed for manual settlement. There are no automatic refunds.',
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
      'Your requests: dishes, stall, drop-off point, status history, payment receipts you attach, ratings you give, and issue reports you file.',
      'If you act as a helper, your payment QR code so requesters can pay you.',
    ],
  },
  {
    heading: 'What we do not collect',
    body: [
      'No bank, card, or payment credentials — payment happens in your own banking app. No location tracking: drop-off points are fixed campus locations you pick per request.',
    ],
  },
  {
    heading: 'How your data is used',
    body: [
      'To run the service: match requests with helpers, show order status, verify payments through receipts, and settle disputes.',
      'To keep accounts secure and prevent misuse. Your data is never sold and never used for advertising.',
    ],
  },
  {
    heading: 'Who can see it',
    body: [
      'Helpers working on your request see its dishes, drop-off point, and receipt you attach. Stalls see incoming demand only. Your email and phone number are never shown to other users.',
    ],
  },
  {
    heading: 'Storage and security',
    body: [
      'Data is stored with access rules that limit every user to their own records. Photos and receipts are stored privately and shared only through short-lived links inside the app.',
    ],
  },
  {
    heading: 'Your control',
    body: [
      'You can update your profile details and photo in Edit Profile, and change your password in Settings. Signing out ends your session on that device.',
    ],
  },
];
