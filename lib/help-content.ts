import type MaterialIcons from '@expo/vector-icons/MaterialIcons';

/**
 * Help Center articles. Every article describes only real, implemented
 * Send2U flows — no aspirational features, no support contacts (none
 * exist in the product). The optional `action` deep-links into the app
 * instead of leaving a dead end.
 */

export interface HelpArticleAction {
  label: string;
  href: '/(requester)/report' | '/(requester)/orders' | '/(requester)/profile';
}

export interface HelpArticle {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  body: string[];
  action?: HelpArticleAction;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'place-request',
    icon: 'receipt-long',
    title: 'How to place a request',
    description: 'Learn the basics of using Send2U',
    body: [
      'Browse the stalls on Home and open a vendor to see what is available. Items marked Unavailable cannot be added right now.',
      'Add dishes to your cart, then open Review Request to check your items and the total.',
      'Pick a campus drop-off point for the handover. Drop-off points are fixed locations set by the campus — you choose one per request.',
      'Submit your request. A helper can then accept it and buy the food on your behalf.',
      'You can cancel a request while no helper has accepted it yet. Once accepted, cancellation is no longer available.',
    ],
  },
  {
    id: 'payment-receipts',
    icon: 'payments',
    title: 'Payment and receipts',
    description: 'Payment instructions and receipt upload',
    body: [
      'Payment happens outside the app. The helper pays for your food upfront at the stall.',
      'After you confirm you received your food, open the request to see the helper’s payment QR code.',
      'Scan the QR code with your banking app and pay the exact total shown.',
      'Attach your payment receipt in the request so the helper can verify it. The request completes once payment is confirmed.',
    ],
  },
  {
    id: 'request-status',
    icon: 'schedule',
    title: 'Request status',
    description: 'Understand your request status',
    body: [
      'Pending: your request is waiting for a helper to accept it.',
      'Accepted through Out for delivery: a helper is working on it — heading to the stall, buying your food, and bringing it to your drop-off point.',
      'Delivered: the helper marked your food as handed over. Open the request and confirm receipt — confirm only food you actually received.',
      'Awaiting payment: pay the helper through their QR code and attach your receipt.',
      'Completed: payment confirmed. Disputed is the exception state — disputed requests need manual settlement.',
    ],
  },
  {
    id: 'account-profile',
    icon: 'person-outline',
    title: 'Account and profile',
    description: 'Manage your account settings',
    body: [
      'You sign in with your email and password. Your role (requester, helper, or vendor) is set once when the account is created and cannot be changed.',
      'Edit Profile lets you set your full name, student ID, phone number, and profile photo. Your email address identifies the account and cannot be changed.',
      'Change Password in Settings updates your sign-in password after confirming your current one.',
      'Signing out from Profile ends your session on this device.',
    ],
    action: { label: 'Open Profile', href: '/(requester)/profile' },
  },
  {
    id: 'report-issue',
    icon: 'report-problem',
    title: 'Report an issue',
    description: 'Let us know if something went wrong',
    body: [
      'Problems can be reported on delivered requests before you confirm receipt. Open the delivered request and choose Report an issue.',
      'Pick the category that fits — not received, incorrect items, damaged, or refused — and add details about what happened.',
      'Reporting moves the request to Disputed for manual settlement. There are no automatic refunds.',
      'Once you confirm receipt, reporting is no longer available — check your food first.',
    ],
    action: { label: 'Report an issue', href: '/(requester)/report' },
  },
];

export function getHelpArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.id === id);
}
