import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { OrderStatus, PaymentStatus, SettlementStatus } from '@/types/domain';

import {
  ESTIMATED_DELIVERY_FEE_CENTS,
  MAX_ACTIVE_JOBS_PER_HELPER,
  helperStatusLabel,
  isActiveOrderStatus,
  isTerminalOrderStatus,
  orderItemsTitle,
  orderStatusLabel,
  orderStatusTone,
  orderTotalCents,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  requesterStatusMessage,
  settlementStatusLabel,
} from './orders.ts';

/** Every member of the `OrderStatus` union — keeps exhaustiveness honest. */
const ALL_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'assigned',
  'preparing',
  'ready_for_pickup',
  'going_to_vendor',
  'at_vendor',
  'food_available',
  'food_purchased',
  'picked_up',
  'out_for_delivery',
  'delivering',
  'delivered',
  'awaiting_requester_payment',
  'completed',
  'cancelled',
  'disputed',
  'accepted',
  'confirmed',
];

/** Every member of the `PaymentStatus` union. */
const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  'submitted',
  'verified',
  'rejected',
  'unpaid',
  'pending',
  'paid',
  'failed',
  'collected',
  'not_collected',
  'refunded',
  'refund_pending',
  'cancelled',
];

const ALL_SETTLEMENT_STATUSES: SettlementStatus[] = ['pending', 'settled', 'failed', 'reversed'];

test('orderTotalCents adds the delivery fee exactly once', () => {
  assert.equal(orderTotalCents(750, 200), 950);
  assert.equal(orderTotalCents(0, 200), 200);
  assert.equal(orderTotalCents(0, 0), 0);
  assert.equal(orderTotalCents(1200, 200), 1400);
});

test('ESTIMATED_DELIVERY_FEE_CENTS is the display-only RM 2.00 estimate', () => {
  assert.equal(ESTIMATED_DELIVERY_FEE_CENTS, 200);
});

test('MAX_ACTIVE_JOBS_PER_HELPER mirrors the server cap', () => {
  assert.equal(MAX_ACTIVE_JOBS_PER_HELPER, 3);
});

test('only completed/cancelled/disputed are terminal', () => {
  const terminal: OrderStatus[] = ['completed', 'cancelled', 'disputed'];
  for (const status of ALL_ORDER_STATUSES) {
    const expected = terminal.includes(status);
    assert.equal(isTerminalOrderStatus(status), expected, `terminal(${status})`);
    assert.equal(isActiveOrderStatus(status), !expected, `active(${status})`);
  }
});

test('orderStatusLabel humanises snake_case keys', () => {
  assert.equal(orderStatusLabel('ready_for_pickup'), 'Ready for pickup');
  assert.equal(orderStatusLabel('out_for_delivery'), 'Out for delivery');
  assert.equal(orderStatusLabel('food_purchased'), 'Food purchased');
  assert.equal(orderStatusLabel('completed'), 'Completed');
});

test('helperStatusLabel never leaks a raw state key for active jobs', () => {
  assert.equal(helperStatusLabel('assigned'), 'Assigned');
  assert.equal(helperStatusLabel('preparing'), 'Being prepared');
  assert.equal(helperStatusLabel('ready_for_pickup'), 'Ready for pickup');
  assert.equal(helperStatusLabel('food_purchased'), 'Purchased');
  assert.equal(helperStatusLabel('delivering'), 'On the way');
  assert.equal(helperStatusLabel('out_for_delivery'), 'On the way');
  assert.equal(helperStatusLabel('confirmed'), 'Confirmed');
});

test('every order status produces a tone and a requester message', () => {
  const tones = ['info', 'success', 'warning', 'error', 'neutral'];
  for (const status of ALL_ORDER_STATUSES) {
    assert.ok(tones.includes(orderStatusTone(status)), `tone(${status})`);
    const message = requesterStatusMessage(status);
    assert.equal(typeof message, 'string');
    assert.notEqual(message.length, 0, `message(${status})`);
    // No user-facing message may fall through to a raw snake_case key.
    assert.ok(!message.includes('_'), `message(${status}) leaked a raw key: ${message}`);
  }
});

test('requesterStatusMessage uses the honest platform-model wording', () => {
  assert.equal(requesterStatusMessage('pending'), 'Waiting for a helper');
  assert.equal(requesterStatusMessage('preparing'), 'Vendor is preparing your food');
  assert.equal(requesterStatusMessage('ready_for_pickup'), 'Food is ready for pickup');
  assert.equal(requesterStatusMessage('food_purchased'), 'Food secured');
  assert.equal(requesterStatusMessage('out_for_delivery'), 'On the way');
  assert.equal(requesterStatusMessage('completed'), 'Completed');
  assert.equal(requesterStatusMessage('cancelled'), 'Cancelled');
  assert.equal(requesterStatusMessage('disputed'), 'Under review');
  // Legacy display values map to their closest honest equivalent.
  assert.equal(requesterStatusMessage('delivering'), 'On the way');
  assert.equal(requesterStatusMessage('accepted'), 'Helper assigned');
});

test('every payment status produces a tone and a label', () => {
  for (const status of ALL_PAYMENT_STATUSES) {
    assert.ok(
      ['info', 'success', 'warning', 'error'].includes(paymentStatusTone(status)),
      `tone(${status})`,
    );
    const label = paymentStatusLabel(status);
    assert.equal(typeof label, 'string');
    assert.notEqual(label.length, 0, `label(${status})`);
    assert.ok(!label.includes('_'), `label(${status}) leaked a raw key: ${label}`);
  }
});

test('paymentStatusTone maps the platform states as documented', () => {
  assert.equal(paymentStatusTone('paid'), 'success');
  assert.equal(paymentStatusTone('collected'), 'success');
  assert.equal(paymentStatusTone('pending'), 'info');
  assert.equal(paymentStatusTone('refund_pending'), 'info');
  assert.equal(paymentStatusTone('unpaid'), 'warning');
  assert.equal(paymentStatusTone('failed'), 'warning');
  assert.equal(paymentStatusTone('not_collected'), 'warning');
  assert.equal(paymentStatusTone('refunded'), 'error');
  assert.equal(paymentStatusTone('cancelled'), 'error');
});

test('paymentStatusLabel maps the platform states as documented', () => {
  assert.equal(paymentStatusLabel('paid'), 'Paid');
  assert.equal(paymentStatusLabel('collected'), 'Cash collected');
  assert.equal(paymentStatusLabel('pending'), 'Payment processing');
  assert.equal(paymentStatusLabel('failed'), 'Payment failed');
  assert.equal(paymentStatusLabel('refunded'), 'Refunded');
  assert.equal(paymentStatusLabel('not_collected'), 'Cash not collected');
});

test('paymentStatusLabel disambiguates `unpaid` by payment rail', () => {
  // Regression: an online order in `unpaid` state must never read as a
  // cash-due state. Only COD orders owe cash on delivery.
  assert.equal(paymentStatusLabel('unpaid', 'cod'), 'Cash due on delivery');
  assert.equal(paymentStatusLabel('unpaid', 'online'), 'Payment due');
  assert.notEqual(paymentStatusLabel('unpaid', 'online'), paymentStatusLabel('unpaid', 'cod'));
  // Method unknown/null degrades to the rail-neutral wording.
  assert.equal(paymentStatusLabel('unpaid'), 'Payment due');
  assert.equal(paymentStatusLabel('unpaid', null), 'Payment due');
  // Method must not change any other state's label.
  for (const status of ALL_PAYMENT_STATUSES) {
    if (status === 'unpaid') continue;
    assert.equal(
      paymentStatusLabel(status, 'cod'),
      paymentStatusLabel(status, 'online'),
      `method leaked into label(${status})`,
    );
  }
});

test('paymentMethodLabel labels both rails and the null case', () => {
  assert.equal(paymentMethodLabel('online'), 'Online Payment');
  assert.equal(paymentMethodLabel('cod'), 'Cash on Delivery');
  assert.equal(paymentMethodLabel(null), 'Payment');
});

test('every settlement status has a label', () => {
  for (const status of ALL_SETTLEMENT_STATUSES) {
    const label = settlementStatusLabel(status);
    assert.equal(typeof label, 'string');
    assert.notEqual(label.length, 0, `label(${status})`);
    assert.ok(!label.includes('_'), `label(${status}) leaked a raw key: ${label}`);
  }
});

test('orderItemsTitle summarises item snapshots', () => {
  assert.equal(orderItemsTitle([]), 'Your request');
  assert.equal(orderItemsTitle([{ itemName: 'Nasi Ayam', quantity: 1 }]), 'Nasi Ayam');
  assert.equal(orderItemsTitle([{ itemName: 'Nasi Ayam', quantity: 2 }]), '2 × Nasi Ayam');
  assert.equal(
    orderItemsTitle([
      { itemName: 'Nasi Ayam', quantity: 1 },
      { itemName: 'Teh Ais', quantity: 1 },
    ]),
    'Nasi Ayam + Teh Ais',
  );
  assert.equal(
    orderItemsTitle([
      { itemName: 'Nasi Ayam', quantity: 1 },
      { itemName: 'Teh Ais', quantity: 1 },
      { itemName: 'Kuih', quantity: 3 },
    ]),
    'Nasi Ayam + 2 more',
  );
});

test('payment brands settle on exactly two rails', async () => {
  const { PAYMENT_BRANDS, paymentBrandById } = await import('./orders.ts');
  assert.ok(PAYMENT_BRANDS.length >= 6);
  for (const brand of PAYMENT_BRANDS) {
    assert.ok(brand.label.length > 0, `brand(${brand.id}) needs a label`);
    assert.ok(brand.hint.length > 0, `brand(${brand.id}) needs a hint`);
    assert.ok(
      brand.method === 'online' || brand.method === 'cod',
      `brand(${brand.id}) must settle on online or cod`,
    );
  }
  const cash = PAYMENT_BRANDS.find((brand) => brand.id === 'cash');
  assert.equal(cash?.method, 'cod');
  for (const brand of PAYMENT_BRANDS) {
    if (brand.id === 'cash') continue;
    assert.equal(brand.method, 'online', `brand(${brand.id}) must settle online`);
  }
  assert.equal(paymentBrandById('visa')?.label, 'Visa');
  assert.equal(paymentBrandById('nope'), null);
  assert.equal(paymentBrandById(null), null);
});
