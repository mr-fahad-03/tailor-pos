'use client';

import { fmt, fmtDate, orderNo } from '@/lib/format';
import { amountInWords } from '@/lib/words';
import { formatAddress, type AppSettings, type JobCard, type Ledger } from '@/lib/types';

/**
 * An order's invoice, laid out to be printed.
 *
 * Every label is given in English and Arabic because that is what a UAE
 * customer and a UAE auditor each expect to read, and the pair sits on one
 * line so neither language looks like an afterthought.
 *
 * Sizes are in points rather than Tailwind's rem scale: this is the one view
 * in the app whose job is paper, and a point is the same length on paper
 * whatever the browser's font size happens to be.
 */

/** English over Arabic, as every label on the sheet is written. */
function L({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="font-bold">{en}</span>
      <span className="pl-2 text-[7pt] text-neutral-500" dir="rtl">
        {ar}
      </span>
    </>
  );
}

/** One row of the two detail boxes under the masthead. */
function DetailRow({ en, ar, value }: { en: string; ar: string; value?: string }) {
  return (
    <tr>
      <td className="whitespace-nowrap py-[3px] pr-2 align-top text-[7.5pt] font-bold uppercase">
        {en}
      </td>
      <td className="w-full py-[3px] pr-2 align-top text-[7.5pt] [overflow-wrap:anywhere]">
        {value || '—'}
      </td>
      <td
        className="whitespace-nowrap py-[3px] align-top text-[7pt] text-neutral-500"
        dir="rtl"
      >
        {ar}
      </td>
    </tr>
  );
}

/** One figure in the totals block. */
function TotalRow({
  en,
  ar,
  value,
  strong = false,
}: {
  en: string;
  ar: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? 'font-bold' : ''}>
      <td className="whitespace-nowrap py-[3px] pr-3 text-[7.5pt] font-bold uppercase">{en}</td>
      <td className="whitespace-nowrap py-[3px] pr-3 text-right text-[7.5pt] tabular-nums">
        {value}
      </td>
      <td className="whitespace-nowrap py-[3px] text-left text-[7pt] text-neutral-500" dir="rtl">
        {ar}
      </td>
    </tr>
  );
}

export function OrderInvoice({
  card,
  settings,
  customer,
}: {
  card: JobCard;
  settings: AppSettings;
  /** Supplies the address and email, which the order itself does not hold. */
  customer?: Ledger | null;
}) {
  const { company, bank } = settings;
  const rows = (card.items ?? []).filter(
    (r) => (r.productName ?? '').trim() || r.amount > 0,
  );
  const afterDiscount = Math.round((card.total + card.additionalCharges - card.discount) * 100) / 100;

  /** How this order was actually settled, rather than what was planned. */
  const modes = Array.from(new Set((card.payments ?? []).map((p) => p.mode)));
  const paymentMethod = modes.length
    ? modes
        .map((m) => (m === 'bank' ? 'Bank Transfer' : m === 'card' ? 'Card' : 'Cash'))
        .join(' + ')
    : 'Unpaid';

  const bankLines = [
    bank.name && `BANK NAME: ${bank.name}`,
    bank.accountType && `ACCOUNT TYPE: ${bank.accountType}`,
    bank.accountName && `ACCOUNT NAME: ${bank.accountName}`,
    bank.accountNo && `ACCOUNT NUMBER: ${bank.accountNo}`,
    bank.iban && `IBAN NUMBER: ${bank.iban}`,
    bank.swift && `SWIFT CODE: ${bank.swift}`,
    bank.chequeFavour && `Cheques to be issued in Favour of "${bank.chequeFavour}"`,
    bank.note,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-[10mm] text-[8pt] leading-snug text-neutral-900 print:max-w-none print:p-0">
      {/* masthead */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-3">
        <div className="min-w-0">
          <p className="text-[12pt] font-black uppercase leading-tight">
            {company.name || 'Your company name — set it in Settings'}
          </p>
          {company.address && <p className="mt-0.5 text-[7.5pt]">{company.address}</p>}
          <p className="mt-0.5 text-[7.5pt]">
            {[company.phone && `Mobile: ${company.phone}`, company.email && `Email: ${company.email}`]
              .filter(Boolean)
              .join('  ')}
          </p>
          {company.website && <p className="text-[7.5pt]">{company.website}</p>}
          {company.trn && <p className="text-[7.5pt] font-bold">TRN: {company.trn}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13pt] font-black uppercase leading-tight text-[#4b6b1f]">
            Order Invoice
          </p>
          <p className="text-[8pt] text-neutral-600" dir="rtl">
            فاتورة الطلب
          </p>
        </div>
      </div>

      {/* who and when */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 border border-neutral-300 p-2">
        <table className="w-full border-collapse">
          <tbody>
            <DetailRow
              en="Cus Name"
              ar="اسم العميل"
              value={
                customer?.invoiceOnCompanyName && customer.businessName
                  ? customer.businessName
                  : card.partyName
              }
            />
            <DetailRow en="Email" ar="البريد الإلكتروني" value={customer?.email} />
            {/* The buyer's own TRN, which a VAT-registered customer needs on
                the invoice to reclaim the tax. */}
            <DetailRow en="Cus TRN" ar="الرقم الضريبي" value={customer?.trn} />
            <DetailRow en="Phone" ar="رقم الهاتف" value={card.phone} />
            <DetailRow en="Cus Add" ar="عنوان العميل" value={formatAddress(customer)} />
          </tbody>
        </table>
        <table className="w-full border-collapse">
          <tbody>
            <DetailRow en="Inv No" ar="رقم الفاتورة" value={orderNo(card)} />
            <DetailRow en="Ref" ar="المرجع" value={card.ref} />
            <DetailRow en="Date" ar="تاريخ الفاتورة" value={fmtDate(card.date)} />
            <DetailRow en="Delivery" ar="تاريخ التسليم" value={fmtDate(card.deliveryDate)} />
            <DetailRow en="Payment Method" ar="طريقة الدفع" value={paymentMethod} />
          </tbody>
        </table>
      </div>

      {/* what was ordered */}
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-[#5b7f27] text-white print:[print-color-adjust:exact]">
            <th className="w-[55%] border border-neutral-400 px-2 py-1.5 text-left text-[7.5pt] font-bold uppercase">
              <L en="Product Name" ar="اسم المنتج" />
            </th>
            <th className="border border-neutral-400 px-2 py-1.5 text-right text-[7.5pt] font-bold uppercase">
              <L en="U.Price AED" ar="سعر الوحدة" />
            </th>
            <th className="border border-neutral-400 px-2 py-1.5 text-center text-[7.5pt] font-bold uppercase">
              <L en="Quantity" ar="الكمية" />
            </th>
            <th className="border border-neutral-400 px-2 py-1.5 text-right text-[7.5pt] font-bold uppercase">
              <L en="Total AED" ar="الإجمالي" />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="border border-neutral-400 px-2 py-4 text-center text-neutral-500"
              >
                No items on this order.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td className="border border-neutral-400 px-2 py-1.5 align-top [overflow-wrap:anywhere]">
                  {r.code ? <span className="font-mono text-[7pt]">{r.code} · </span> : null}
                  {r.productName}
                </td>
                <td className="border border-neutral-400 px-2 py-1.5 text-right align-top tabular-nums">
                  {fmt(r.rate)}
                </td>
                <td className="border border-neutral-400 px-2 py-1.5 text-center align-top tabular-nums">
                  {fmt(r.qty)}
                </td>
                <td className="border border-neutral-400 px-2 py-1.5 text-right align-top tabular-nums">
                  {fmt(r.amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* what it comes to */}
      <div className="mt-3 flex items-start justify-between gap-8">
        <table className="border-collapse">
          <tbody>
            <TotalRow en="Paid Amount" ar="المبلغ المدفوع" value={`AED ${fmt(card.advance)}`} />
            <TotalRow en="Due Amount" ar="المبلغ المستحق" value={`AED ${fmt(card.balance)}`} />
            <TotalRow
              en="Additional Charges"
              ar="رسوم إضافية"
              value={`AED ${fmt(card.additionalCharges)}`}
            />
          </tbody>
        </table>

        <div className="min-w-[72mm]">
          <table className="w-full border-collapse">
            <tbody>
              <TotalRow en="Subtotal" ar="المجموع الفرعي" value={`AED ${fmt(card.total)}`} />
              <TotalRow en="Discount" ar="الخصم" value={`AED ${fmt(card.discount)}`} />
              <TotalRow
                en="After Discount"
                ar="المبلغ بعد الخصم"
                value={`AED ${fmt(afterDiscount)}`}
              />
              <TotalRow
                en={`VAT ${settings.taxRate}%`}
                ar="ضريبة القيمة المضافة"
                value={`AED ${fmt(card.tax)}`}
              />
            </tbody>
          </table>
          <div className="mt-1 flex items-center justify-between gap-4 bg-[#5b7f27] px-2 py-1.5 text-white print:[print-color-adjust:exact]">
            <span className="text-[8pt] font-bold uppercase">Net Amount</span>
            <span className="text-[9pt] font-black tabular-nums">AED {fmt(card.netAmount)}</span>
            <span className="text-[7pt]" dir="rtl">
              المبلغ الصافي
            </span>
          </div>
        </div>
      </div>

      {/* the figure spelled out, which is what settles an argument over it */}
      <div className="mt-3">
        <p className="text-[7.5pt] font-bold uppercase">
          Amount in Words <span className="pl-2 font-normal text-neutral-500" dir="rtl">المبلغ كتابة</span>
        </p>
        <p className="text-[7.5pt]">{amountInWords(card.netAmount)}</p>
      </div>

      {/* how to pay the rest */}
      {bankLines.length > 0 && (
        <div className="mt-3 border-t border-neutral-300 pt-2">
          <p className="text-[7.5pt] font-bold uppercase">
            *Bank Details <span className="pl-2 font-normal text-neutral-500" dir="rtl">تفاصيل البنك</span>
          </p>
          <ul className="mt-1 space-y-[1px]">
            {bankLines.map((line, i) => (
              <li key={i} className="text-[7.5pt] [overflow-wrap:anywhere]">
                - {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
