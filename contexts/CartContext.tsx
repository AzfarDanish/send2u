import { createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode } from 'react';

import type { CartLine, MenuItemWithVendor } from '@/types/domain';

const MAX_QUANTITY = 99;

type CartAction =
  | { type: 'add'; item: MenuItemWithVendor; quantity: number }
  | { type: 'setQty'; itemId: string; quantity: number }
  | { type: 'remove'; itemId: string }
  | { type: 'clear' };

interface CartState {
  lines: CartLine[];
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const qty = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(action.quantity)));
      const existing = state.lines.find((line) => line.item.id === action.item.id);
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.item.id === action.item.id
              ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + qty) }
              : line,
          ),
        };
      }
      return { lines: [...state.lines, { item: action.item, quantity: qty }] };
    }
    case 'setQty': {
      if (action.quantity <= 0) {
        return { lines: state.lines.filter((line) => line.item.id !== action.itemId) };
      }
      return {
        lines: state.lines.map((line) =>
          line.item.id === action.itemId
            ? { ...line, quantity: Math.min(MAX_QUANTITY, Math.floor(action.quantity)) }
            : line,
        ),
      };
    }
    case 'remove':
      return { lines: state.lines.filter((line) => line.item.id !== action.itemId) };
    case 'clear':
      return { lines: [] };
  }
}

interface CartContextValue {
  lines: CartLine[];
  /** Total item count (sum of quantities). */
  count: number;
  /** Simple sum of price × quantity. No fees, taxes, or discounts (MVP). */
  subtotalCents: number;
  addItem: (item: MenuItemWithVendor, quantity: number) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
  /** Selected drop-off point for the current draft request. In-memory only. */
  locationId: string | null;
  setLocationId: (locationId: string | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Local in-memory cart. Intentionally not persisted: the Create tab submits
 * it through `placeOrders` (one order per vendor) and clears it only after
 * confirmed database success. No fees, checkout, or payment here. The
 * selected drop-off point rides along as draft state so the Location
 * picker page and Review Request share one selection; it resets with
 * the cart.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { lines: [] });
  const [locationId, setLocationId] = useState<string | null>(null);

  const clear = useCallback(() => {
    dispatch({ type: 'clear' });
    setLocationId(null);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = state.lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotalCents = state.lines.reduce(
      (sum, line) => sum + line.item.priceCents * line.quantity,
      0,
    );
    return {
      lines: state.lines,
      count,
      subtotalCents,
      addItem: (item, quantity) => dispatch({ type: 'add', item, quantity }),
      setQuantity: (itemId, quantity) => dispatch({ type: 'setQty', itemId, quantity }),
      removeItem: (itemId) => dispatch({ type: 'remove', itemId }),
      clear,
      locationId,
      setLocationId,
    };
  }, [state, locationId, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
