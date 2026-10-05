'use client';

import { PartyPage, type PartyConfig } from '@/components/PartyPage';

const CONFIG: PartyConfig = {
  type: 'wholesaler',
  title: 'Wholesalers',
  noun: 'wholesaler',
  sub: 'Trade accounts buying in bulk at wholesale rates',
  showTrn: true,
  showOpeningBalance: true,
  nameLabel: 'Wholesaler Name',
  addressLabel: 'Address',
};

export default function WholesalersPage() {
  return <PartyPage config={CONFIG} />;
}
