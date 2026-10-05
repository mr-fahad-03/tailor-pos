export interface Ledger {
  _id: string;
  name: string;
  phone?: string;
  address?: string;
  trn?: string;
  openingBalance: number;
  type: 'customer' | 'supplier' | 'wholesaler' | 'general';
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

/** A length of cloth or trim consumed by one person's garment. */
export interface MaterialLine {
  code?: string;
  productName?: string;
  qty: number;
  rate: number;
}

/** One person being stitched for on an order. */
export interface MeasurementSet {
  profileId?: string;
  name: string;
  fabric?: string;
  size?: string;
  qty: number;
  values: Record<string, string>;
  /** Materials consumed for this person, costed on their own block. */
  materials?: MaterialLine[];
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
  /**
   * The customer this person is filed under. Present on any list that spans
   * customers — a bare name does not identify anyone, since two customers can
   * each have an "Ali".
   */
  ledgerName?: string;
  ledgerPhone?: string;
  ledgerType?: string;
}

export type JobCardStatus = 'draft' | 'open' | 'closed' | 'converted';

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

export interface DashboardRange {
  from: string;
  to: string;
}

export interface DashboardSummary {
  range: DashboardRange;
  sales: {
    gross: number;
    returns: number;
    net: number;
    billCount: number;
    returnCount: number;
  };
  orders: {
    newOrders: number;
    pending: number;
    delivered: number;
  };
  payments: {
    cash: number;
    bank: number;
    card: number;
    credit: number;
    total: number;
  };
  totalCustomers: number;
  recentJobCards: JobCard[];
  recentSales: Sale[];
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

/** Per-order outcome of a bulk convert — some rows can be skipped. */
export interface BulkConvertResult {
  converted: { id: string; no: number; billNo: number }[];
  skipped: { id: string; no?: number; reason: string }[];
}

export type AuditAction = 'create' | 'update' | 'payment' | 'close' | 'reopen' | 'convert';

export interface AuditChange {
  field: string;
  from: string;
  to: string;
}

/** One entry in the Super Admin change log. */
export interface AuditEntry {
  _id: string;
  entity: 'jobcard';
  entityId: string;
  entityNo?: number;
  entityRef?: string;
  partyName?: string;
  action: AuditAction;
  summary?: string;
  changes: AuditChange[];
  username: string;
  userName: string;
  at: string;
}
