'use client';

import { PartyPage, type PartyConfig } from '@/components/PartyPage';

const CONFIG: PartyConfig = {
  type: 'customer',
  title: 'Customers',
  noun: 'customer',
  sub: 'People who bring work in and are billed for it',
  addressLabel: 'Address',
};

export default function CustomersPage() {
  return <PartyPage config={CONFIG} />;
}
