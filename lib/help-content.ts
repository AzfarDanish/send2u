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
      'Choose how to pay: Online Payment (pay in Send2U, simulated for this demo) or Cash on Delivery (pay the helper in cash when your food arrives).',
      'Submit your request. Send2U records the transaction, the cafeteria prepares your food, and a helper delivers it. Helpers never pay for your food.',
      'You can cancel a request while the kitchen has not committed to it. Records are always kept — cancelled requests stay in your history.',
    ],
  },
  {
    id: 'payment-receipts',
    icon: 'payments',
    title: 'Payment and receipts',
    description: 'How payment works on Send2U',
    body: [
      'Send2U manages every transaction. At checkout you choose Online Payment or Cash on Delivery.',
      'Online Payment: pay the exact total in Send2U right after ordering (simulated for this demo — no real money moves and no bank app is needed). Your cafeteria sees the paid order and starts preparing.',
      'Cash on Delivery: pay the full total in cash to your helper when your food arrives. The helper records the collection in the app — the cash belongs to Send2U, and the helper earns the delivery fee.',
      'There are no helper QR codes and no receipt uploads. If an online payment fails, simply retry from the request — you can never be charged twice.',
    ],
  },
  {
    id: 'request-status',
    icon: 'schedule',
    title: 'Request status',
    description: 'Understand your request status',
    body: [
      'Pending: your request is waiting for a helper to accept it.',
      'Preparing and Ready for pickup: the cafeteria confirmed your order and is getting it ready.',
      'Assigned through Out for delivery: a helper is working on it — heading to the stall, collecting your Send2U-covered food, and bringing it to your drop-off point.',
      'Delivered: the helper marked your food as handed over. Open the request and confirm receipt — confirm only food you actually received.',
      'Confirmed and Completed: your transaction is settling and the record (method, payment, cafeteria/helper/Send2U split) is stored on the request.',
      'Cancelled and Disputed are the exception states — cancelled requests stay in your history, and disputed requests go to review.',
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
      'Reporting moves the request to Disputed for review. Online payments on cancelled orders are recorded as refunded (simulated for this demo).',
      'Once you confirm receipt, reporting is no longer available — check your food first.',
    ],
    action: { label: 'Report an issue', href: '/(requester)/report' },
  },
];

export function getHelpArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.id === id);
}
