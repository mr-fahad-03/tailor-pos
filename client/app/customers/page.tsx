'use client';

import { PartyPage, type PartyConfig } from '@/components/PartyPage';

const CONFIG: PartyConfig = {
  type: 'customer',
  title: 'Customers',
  noun: 'customer',
  sub: 'People who bring work in and are billed for it',
  showTrn: true,
  showOpeningBalance: true,
  nameLabel: 'Customer Name',
  addressLabel: 'Address',
};

export default function CustomersPage() {
  return <PartyPage config={CONFIG} />;
}
