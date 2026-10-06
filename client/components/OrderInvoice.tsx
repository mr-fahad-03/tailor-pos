'use client';

import { fmt, fmtDate, orderNo } from '@/lib/format';
import { amountInWords } from '@/lib/words';
import { formatAddress, type AppSettings, type JobCard, type Ledger } from '@/lib/types';

/**
 * An order's invoice, laid out to be printed.
 *
 * Every label is given in English and Arabic because that is what a UAE
 * customer and a UAE auditor each expect to read, and the two sit on one line
 * so neither language looks like an afterthought: English reads in from the
 * left, Arabic in from the right, and the value sits between them.
 *
 * Sizes are in points rather than Tailwind's rem scale: this is the one view
 * in the app whose job is paper, and a point is the same length on paper
 * whatever the browser's font size happens to be.
 *
 * Nothing on the sheet is written into the code — the masthead, the two
 * marks, the title and the bank block all come from Settings, so the shop can
 * change its own letterhead without a release.
 */

const GREEN = '#5b7f27';
const RULE = '#8fb858';
const CELL = '#c3d9a0';

/** One row of the box under the masthead: English, the value, then Arabic. */
function DetailRow({
  en,
  ar,
  value,
  wide = false,
}: {
  en: string;
  ar: string;
  value?: string;
  /** A row that runs the width of the box rather than sharing it. */
  wide?: boolean;
}) {
  return (
    <tr>
      <td className="whitespace-nowrap py-[2px] pr-2 align-top text-[7pt] font-bold uppercase text-neutral-700">
        {en}:
      </td>
      <td
        className={`py-[2px] pr-2 align-top text-[7.5pt] font-semibold [overflow-wrap:anywhere] ${
          wide ? '' : 'w-full'
        }`}
      >
        {value || '—'}
      </td>
      <td
        className="whitespace-nowrap py-[2px] align-top text-[7pt] text-neutral-600"
        dir="rtl"
      >
        {ar}
      </td>
    </tr>
  );
}

/** One figure in the totals block, laid out like the detail rows above it. */
function TotalRow({ en, ar, value }: { en: string; ar: string; value: string }) {
  return (
    <tr>
      <td className="whitespace-nowrap py-[2px] pr-3 align-top text-[7pt] font-bold uppercase text-neutral-700">
        {en}:
      </td>
      <td className="w-full whitespace-nowrap py-[2px] pr-3 align-top text-[7.5pt] font-bold tabular-nums">
        {value}
      </td>
      <td className="whitespace-nowrap py-[2px] align-top text-[7pt] text-neutral-600" dir="rtl">
        {ar}
      </td>
    </tr>
  );
}

/** A column heading, English over Arabic as the sheet writes them. */
function Head({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="block">{en}</span>
      <span className="block font-normal" dir="rtl">
        {ar}
      </span>
    </>
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
  const rows = (card.items ?? []).filter((r) => (r.productName ?? '').trim() || r.amount > 0);
  const afterDiscount =
    Math.round((card.total + card.additionalCharges - card.discount) * 100) / 100;

  /** How this order was actually settled, rather than what was planned. */
  const modes = Array.from(new Set((card.payments ?? []).map((p) => p.mode)));
  const paymentMethod = modes.length
    ? modes.map((m) => (m === 'bank' ? 'Bank Transfer' : m === 'card' ? 'Card' : 'Cash')).join(' + ')
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

  const cell = { borderColor: CELL };

  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-[10mm] text-[8pt] leading-snug text-neutral-900 print:max-w-none print:p-[8mm]">
      {/* masthead: the shop's mark, its details, and any second brand */}
      <div className="flex items-start justify-between gap-4">
        {company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logo}
            alt=""
            className="h-[16mm] w-[38mm] shrink-0 object-contain object-left"
          />
        ) : (
          <div className="w-[38mm] shrink-0" />
        )}

        <div className="min-w-0 flex-1 text-[7.5pt] leading-[1.45]">
          <p className="text-[8.5pt] font-bold uppercase">
            {company.name || 'Your company name — set it in Settings'}
          </p>
          {company.address && <p>{company.address}</p>}
          <p>
            {[company.phone && `Mobile: ${company.phone}`, company.email && `Email: ${company.email}`]
              .filter(Boolean)
              .join(' ')}
          </p>
          {company.website && <p>{company.website}</p>}
          {company.trn && <p className="font-bold">TRN: {company.trn}</p>}
        </div>

        {(company.brandLogo || company.brandTagline) && (
          <div className="w-[34mm] shrink-0 text-center">
            {company.brandLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.brandLogo}
                alt=""
                className="mx-auto h-[12mm] w-full object-contain"
              />
            )}
            {company.brandTagline && (
              <p className="mt-[1mm] text-[6pt] text-neutral-600">{company.brandTagline}</p>
            )}
          </div>
        )}
      </div>

      {/* what the sheet calls itself, over the rule that opens the body */}
      <p className="mt-[2mm] text-[11pt] font-bold text-[#e03131] print:[print-color-adjust:exact]">
        {settings.invoiceTitle || 'Order Invoice'}
      </p>
      <div
        className="mt-[1mm] h-[1.5px] w-full print:[print-color-adjust:exact]"
        style={{ backgroundColor: RULE }}
      />

      {/* who it is for, and which order it is */}
      <div className="mt-[3mm] rounded-[3mm] bg-neutral-100 px-[4mm] py-[3mm] print:[print-color-adjust:exact]">
        <div className="grid grid-cols-2 gap-x-[6mm]">
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
              <DetailRow en="Phone" ar="رقم الهاتف" value={card.phone || customer?.phone} />
            </tbody>
          </table>
          <table className="w-full border-collapse">
            <tbody>
              <DetailRow en="Inv No" ar="رقم الفاتورة" value={orderNo(card)} />
              <DetailRow en="Date" ar="تاريخ الفاتورة" value={fmtDate(card.date)} />
              <DetailRow en="Payment Method" ar="طريقة الدفع" value={paymentMethod} />
            </tbody>
          </table>
        </div>
        {/* The address and the collection date run the width of the box: one
            is too long to share a column, and the other is the thing the
            customer comes back for. */}
        <table className="w-full border-collapse">
          <tbody>
            <DetailRow en="Cus Add" ar="عنوان العميل" value={formatAddress(customer)} wide />
            <DetailRow
              en="Delivery Date"
              ar="تاريخ التسليم"
              value={fmtDate(card.deliveryDate)}
              wide
            />
          </tbody>
        </table>
      </div>

      {/* what was ordered */}
      <table className="mt-[3mm] w-full border-collapse">
        <thead>
          <tr
            className="text-white print:[print-color-adjust:exact]"
            style={{ backgroundColor: GREEN }}
          >
            <th
              className="border px-[2mm] py-[2mm] text-center text-[7.5pt] font-bold uppercase"
              style={cell}
            >
              <Head en="Product Name" ar="اسم المنتج" />
            </th>
            <th
              className="w-[22mm] border px-[2mm] py-[2mm] text-center text-[7pt] font-bold uppercase"
              style={cell}
            >
              <Head en="U.Price AED" ar="سعر الوحدة" />
            </th>
            <th
              className="w-[22mm] border px-[2mm] py-[2mm] text-center text-[7pt] font-bold uppercase"
              style={cell}
            >
              <Head en="Quantity" ar="الكمية" />
            </th>
            <th
              className="w-[24mm] border px-[2mm] py-[2mm] text-center text-[7pt] font-bold uppercase"
              style={cell}
            >
              <Head en="Total AED" ar="الإجمالي" />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="border px-[2mm] py-[6mm] text-center text-neutral-500" style={cell}>
                No items on this order.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td
                  className="border px-[2mm] py-[2mm] align-top text-[7.5pt] [overflow-wrap:anywhere]"
                  style={cell}
                >
                  {r.productName}
                </td>
                <td
                  className="border px-[2mm] py-[2mm] text-center align-top text-[7.5pt] tabular-nums"
                  style={cell}
                >
                  {fmt(r.rate)}
                </td>
                <td
                  className="border px-[2mm] py-[2mm] text-center align-top text-[7.5pt] tabular-nums"
                  style={cell}
                >
                  {fmt(r.qty)} Pc
                </td>
                <td
                  className="border px-[2mm] py-[2mm] text-center align-top text-[7.5pt] tabular-nums"
                  style={cell}
                >
                  {fmt(r.amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* what it comes to: what has been settled on the left, how the figure
          was arrived at on the right */}
      <div className="mt-[3mm] grid grid-cols-2 items-start gap-x-[8mm]">
        <table className="w-full border-collapse">
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

        <div>
          <table className="w-full border-collapse">
            <tbody>
              <TotalRow en="Subtotal" ar="المجموع الفرعي" value={`AED ${fmt(card.total)}`} />
              <TotalRow en="Discount" ar="الخصم" value={`AED ${fmt(card.discount)}`} />
              <TotalRow
                en="After Discount"
                ar="المبلغ بعد الخصم"
                value={`AED ${fmt(afterDiscount)}`}
              />
              {/* Shown rather than folded in: without it the net figure does
                  not follow from the ones above, and a UAE invoice has to say
                  what tax was charged. */}
              <TotalRow
                en={`VAT ${settings.taxRate}%`}
                ar="ضريبة القيمة المضافة"
                value={`AED ${fmt(card.tax)}`}
              />
            </tbody>
          </table>
          <div
            className="mt-[2mm] flex items-center justify-between gap-[3mm] px-[3mm] py-[2mm] text-white print:[print-color-adjust:exact]"
            style={{ backgroundColor: GREEN }}
          >
            <span className="text-[8pt] font-bold uppercase">Net Amount</span>
            <span className="text-[9pt] font-black tabular-nums">AED {fmt(card.netAmount)}</span>
            <span className="text-[7pt]" dir="rtl">
              المبلغ الصافي
            </span>
          </div>
        </div>
      </div>

      {/* the figure spelled out, which is what settles an argument over it */}
      <div className="mt-[3mm]">
        <p className="text-[7.5pt] font-bold uppercase">
          Amount in Words
          <span className="pl-2 font-normal text-neutral-600" dir="rtl">
            المبلغ كتابة
          </span>
        </p>
        <p className="text-[7.5pt] text-neutral-700">{amountInWords(card.netAmount)}</p>
      </div>

      {/* how to pay the rest */}
      {bankLines.length > 0 && (
        <div className="mt-[4mm] border-t border-neutral-300 pt-[2mm]">
          <p className="text-[7.5pt] font-bold uppercase">
            *Bank Details
            <span className="pl-2 font-normal text-neutral-600" dir="rtl">
              تفاصيل البنك
            </span>
          </p>
          <ul className="mt-[1mm] space-y-[0.5mm]">
            {bankLines.map((line, i) => (
              <li key={i} className="text-[7.5pt] text-neutral-700 [overflow-wrap:anywhere]">
                - {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
