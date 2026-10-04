export interface Ledger {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  trn?: string;
  openingBalance: number;
  type: 'customer' | 'supplier' | 'general';
}

export interface Product {
  _id: string;
  code: string;
  name: string;
  rate: number;
  wholesaleRate: number;
  category: 'stitching' | 'fabric' | 'material';
  unit: string;
  stockQty: number;
}

export interface JobCardItem {
  code?: string;
  productName?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface JobCardMaterial {
  code?: string;
  productName?: string;
  qty: number;
  rate: number;
}

export type PaymentMode = 'cash' | 'bank' | 'card' | 'credit';

export interface JobCardPayment {
  date: string;
  mode: PaymentMode;
  amount: number;
  bank?: string;
  reference?: string;
  discount: number;
  note?: string;
}

/** One person being stitched for on an order. */
export interface MeasurementSet {
  profileId?: string;
  name: string;
  fabric?: string;
  size?: string;
  qty: number;
  values: Record<string, string>;
}

/** A person kept on file under a customer, reusable on later orders. */
export interface MeasurementProfile {
  _id: string;
  ledgerId: string;
  name: string;
  fabric?: string;
  size?: string;
  values: Record<string, string>;
  note?: string;
  archived: boolean;
  lastUsedAt?: string;
}

export type JobCardStatus = 'open' | 'closed' | 'converted';

export interface JobCard {
  _id: string;
  no: number;
  bookNo: number;
  ref: string;
  date: string;
  deliveryDate?: string;
  partyName?: string;
  phone?: string;
  ledgerId?: string;
  isNewCustomer: boolean;
  accountsAc?: string;
  invoiceNo?: string;
  items: JobCardItem[];
  total: number;
  discount: number;
  tax: number;
  netAmount: number;
  measurements: Record<string, string>;
  measurementSets: MeasurementSet[];
  fabric?: string;
  size?: string;
  materialsUsed: JobCardMaterial[];
  materialTotal: number;
  jobCost: number;
  advance: number;
  advanceBeforeTax: number;
  advanceTax: number;
  balance: number;
  paymentMode: 'cash' | 'bank' | 'card';
  bank?: string;
  creditCardNo?: string;
  payments: JobCardPayment[];
  status: JobCardStatus;
  closedAt?: string;
}

export interface SaleItem {
  code?: string;
  productName?: string;
  qty: number;
  rate: number;
  netRate: number;
  discPercent: number;
  discAmt: number;
  grossAmt: number;
  taxPercent: number;
  taxAmt: number;
  netAmount: number;
}

export interface Sale {
  _id: string;
  billNo: number;
  billDate: string;
  saleType: 'retail' | 'wholesale' | 'distributor';
  paymentType: 'cash' | 'credit';
  category: 'A' | 'B';
  creditCardNo?: string;
  jobCardRef?: string;
  jobCardId?: string;
  salesman: string;
  partyName?: string;
  phone?: string;
  ledgerId?: string;
  delDate?: string;
  landmark?: string;
  trn?: string;
  vehicleNo?: string;
  items: SaleItem[];
  totQty: number;
  grossAmount: number;
  discountAmt: number;
  additionalDiscount: number;
  taxAmt: number;
  freight: number;
  advanceAmount: number;
  netAmount: number;
  balance: number;
  isReturn: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardSummary {
  todaySales: number;
  todayBills: number;
  monthSales: number;
  monthBills: number;
  openJobCards: number;
  totalCustomers: number;
  recentJobCards: JobCard[];
  lowStock: Product[];
}

export interface FlatPayment {
  jobCardNo: number;
  jobCardRef: string;
  jobCardId: string;
  partyName?: string;
  date: string;
  mode: PaymentMode;
  amount: number;
  bank?: string;
  reference?: string;
  discount: number;
}

export interface AppSettings {
  taxRate: number;
  bookNo: number;
  salesman: string;
  deliveryDays: number;
}

export const MEASURE_FIELDS = [
  'LEN',
  'HAND',
  'SHOUL',
  'CHEST',
  'COLLAR',
  'B.LOOSE',
  'WRIST',
  'K.CHEST',
  'BOTTOM',
  'WEST',
  'A',
  'H.LOOS',
  'H.KASHF',
  'T.R.',
  'K.',
  'Q.',
];

/* ------------------------------------------------------------------ auth */

export type Role = 'super_admin' | 'admin' | 'salesman';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  salesman: 'Salesman',
};

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  roleLabel: string;
  active: boolean;
  permissions: string[];
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

export interface PermissionGroup {
  group: string;
  items: { key: string; label: string }[];
}

export interface PermissionCatalog {
  permissions: string[];
  groups: PermissionGroup[];
  roleLabels: Record<Role, string>;
}
