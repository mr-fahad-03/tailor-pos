'use client';

import { PartyPage, type PartyConfig } from '@/components/PartyPage';

const CONFIG: PartyConfig = {
  type: 'supplier',
  title: 'Suppliers',
  noun: 'supplier',
  sub: 'Where fabric, trims and materials are bought from',
  showTrn: true,
  showOpeningBalance: true,
  nameLabel: 'Supplier Name',
  addressLabel: 'Address',
};

export default function SuppliersPage() {
  return <PartyPage config={CONFIG} />;
}
