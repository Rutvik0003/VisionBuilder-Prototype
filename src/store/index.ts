import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { nanoid } from 'nanoid';
import type {
  AccountId, Actor, Address, CartItem, CheckoutDraft, Customer, EventLog, Hub, Lang, Message, Order,
  Product, Rider, RoutePlan, SlotHold, SlotInventory,
} from '../types';
import {
  ADDRESSES, CUSTOMERS, HUBS, PRODUCTS, RIDERS, makeBackground, makePastOrders, makeSlotInventory,
} from '../data/seed';
import { nowIso } from '../lib/time';

const MAX_EVENTS = 1000;

export interface DataState {
  account: AccountId; // which customer account the customer app is signed in as
  showTags: boolean; // feature-ID tags (Launcher setting)
  lang: Lang;
  festiveMode: boolean;
  datePadding: boolean;
  hubs: Hub[];
  riders: Rider[];
  products: Product[];
  customers: Customer[];
  addresses: Address[];
  orders: Order[];
  slots: SlotInventory[];
  holds: SlotHold[]; // C1-F1 checkout holds
  plans: Record<string, RoutePlan | null>; // C3-F3 draft plan per hub|date|run
  runs: Record<string, { lockedAt: string }>; // locked & published runs, key hub|date|run
  call: { orderId: string; kind: 'confirm' | 'vaani'; ringAt: number } | null; // incoming automated call on the customer phone
  messages: Message[];
  events: EventLog[];
  cart: Record<string, CartItem[]>; // per customer
  checkout: CheckoutDraft | null;
  deliverTo: Record<string, string | undefined>; // address chosen on the product page ("Change")
}

interface Actions {
  log: (featureId: string, name: string, actor: Actor, payload?: Record<string, unknown>, orderId?: string) => void;
  setAccount: (a: AccountId) => void;
  setShowTags: (v: boolean) => void;
  setLang: (l: Lang) => void;
  sendMessage: (m: Omit<Message, 'id' | 'at' | 'read'>) => void;
  clearLog: () => void;
  resetDemo: () => void;
  // generic updater for services — keeps mutations inside the store
  patch: (fn: (s: DataState) => Partial<DataState>) => void;
}

export type Store = DataState & Actions;

function initialData(): DataState {
  const bg = makeBackground();
  return {
    account: 'existing',
    showTags: false,
    lang: 'en',
    festiveMode: false,
    datePadding: false,
    hubs: structuredClone(HUBS),
    riders: structuredClone(RIDERS),
    products: structuredClone(PRODUCTS),
    customers: [...structuredClone(CUSTOMERS), ...bg.customers],
    addresses: [...structuredClone(ADDRESSES), ...bg.addresses],
    orders: [...bg.orders, ...makePastOrders()],
    slots: makeSlotInventory(),
    holds: [],
    plans: {},
    runs: {},
    call: null,
    messages: [],
    events: [],
    cart: {},
    checkout: null,
    deliverTo: {},
  };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialData(),

      log: (featureId, name, actor, payload = {}, orderId) =>
        set((s) => ({
          events: [{ id: nanoid(8), at: nowIso(), featureId, name, actor, orderId, payload }, ...s.events].slice(0, MAX_EVENTS),
        })),

      setAccount: (account) => {
        set({ account, checkout: null });
        get().log('APP', 'account_switched', 'customer', { account });
      },

      setShowTags: (showTags) => set({ showTags }),

      setLang: (lang) => set({ lang }),

      sendMessage: (m) =>
        set((s) => ({ messages: [{ ...m, id: nanoid(8), at: nowIso(), read: false }, ...s.messages] })),

      clearLog: () => set({ events: [] }),

      resetDemo: () => {
        set({ ...initialData() });
        get().log('APP', 'prototype_reset', 'system');
      },

      patch: (fn) => set((s) => fn(s)),
    }),
    {
      name: 'meesho-dice-demo',
      version: 16, // bump whenever seed/model shape changes; old saved state is replaced by fresh seed
      migrate: () => initialData() as unknown as Store,
      partialize: (s) =>
        Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as DataState,
    },
  ),
);

// ---- selectors ----

/** The signed-in demo account (always Existing or New — never a background shopper). */
export const useCurrentCustomer = () =>
  useStore((s) => s.customers.find((c) => c.id === s.account)!) as Customer & { id: AccountId };

/** Saved (not deleted) addresses for a customer, default first. */
export const useAddresses = (customerId: AccountId) =>
  useStore(useShallow((s) => {
    const def = s.customers.find((c) => c.id === customerId)?.defaultAddressId;
    return s.addresses
      .filter((a) => a.customerId === customerId && !a.deleted)
      .sort((a, b) => Number(b.id === def) - Number(a.id === def));
  }));

/** The address the customer is shopping for: their "deliver to" pick, else default, else first. */
export const useDeliverTo = (customerId: AccountId): Address | undefined => {
  const list = useAddresses(customerId);
  const picked = useStore((s) => s.deliverTo[customerId]);
  return list.find((a) => a.id === picked) ?? list[0];
};
