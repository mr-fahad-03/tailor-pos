# Tailor POS — How the App Works

A plain-English guide to every screen and every step, from opening the shop in
the morning to handing the customer their invoice.

No technical knowledge needed. Read it top to bottom once, then use the
**Daily Routine** checklist at the end.

---

## 1. What this app replaces

The old Windows program ("P A C : All in one") did four jobs. This app does the
same four jobs in a web browser, on any device in the shop.

```
   ┌─────────────────────────────────────────────────────────┐
   │                                                         │
   │   1. Write down an order        →   JOB CARD            │
   │   2. Take money from customer   →   ADVANCE / PAYMENT   │
   │   3. Turn order into a bill     →   SALES INVOICE       │
   │   4. Keep customer + item lists →   LEDGERS / PRODUCTS  │
   │                                                         │
   └─────────────────────────────────────────────────────────┘
```

Everything is in **AED**, and **5% UAE VAT** is applied to every bill.

---

## 2. The map of the app

The dark bar down the left side is your menu. It is grouped like this:

```
  ┌──────────────────────┐
  │  Tailor POS          │
  ├──────────────────────┤
  │  Dashboard           │  ← today's numbers at a glance
  │                      │
  │  TAILORING           │
  │   Job Cards          │  ← list of all orders
  │   New Job Card       │  ← take a new order
  │                      │
  │  BILLING             │
  │   Sales / Return     │  ← list of all bills
  │   New Sale           │  ← make a bill / do a return
  │                      │
  │  MASTERS             │
  │   Ledgers            │  ← customers & suppliers
  │   Products           │  ← items and their rates
  │                      │
  │  ACCOUNTS            │
  │   Payments           │  ← every rupee collected
  │                      │
  │  ADMIN               │
  │   Users              │  ← staff accounts & permissions
  │   Settings           │  ← VAT %, defaults
  └──────────────────────┘
```

**Important:** you only see the menu items you are allowed to use. A salesman
will not see Payments, Users or Settings at all. This is normal, not a fault.

---

## 3. Who can do what

There are three kinds of account.

| Role | What they can do | Typical person |
|---|---|---|
| **Super Admin** | Everything, always. The owner's account. | You |
| **Admin** | Everything except touching Super Admin accounts. | Shop manager |
| **Salesman** | Take orders, make bills, look up customers and products. Cannot see the money reports, settings, or staff accounts. | Counter staff |

The role is only a **starting point**. On the Users screen you can tick or
untick each ability one by one for any person. Example: give one salesman the
extra ability to "Convert to sale", but not the others.

```
   ROLE  ──sets the──▶  STARTING TICKS  ──you adjust──▶  FINAL PERMISSIONS
                              │
                              └─ 17 separate abilities you can switch on/off
```

---

## 4. Opening the app

1. Start the program (one command in the terminal, kept open all day):
   `npm run dev` inside the project folder.
2. In the browser go to **http://localhost:3000**
3. The sign-in screen appears.

```
   ┌──────────────────┬────────────────────────────┐
   │                  │                            │
   │   Tailor POS     │        Sign in             │
   │                  │                            │
   │   Job cards,     │   Username  [__________]   │
   │   measurements   │   Password  [__________]   │
   │   and billing    │                            │
   │   in one place.  │     [    Sign in    ]      │
   │                  │                            │
   └──────────────────┴────────────────────────────┘
```

Type your username and password, press **Sign in**.

**First time ever:** sign in as `superadmin`, then immediately click your name
in the top-right corner → **Change password**.

You stay signed in for 12 hours, then it asks again.

---

## 5. The main flow of the business

This is the one picture to remember. Everything else supports it.

```
   CUSTOMER WALKS IN
          │
          ▼
   ┌──────────────┐
   │  JOB CARD    │   Write the order: what, how many, measurements.
   │   No. 13259  │   Takes an advance payment.
   └──────┬───────┘
          │
          │   ... tailor stitches the garment ...
          │       (more part payments can be taken any time)
          ▼
   ┌──────────────┐
   │ CLOSE THE    │   Work is finished. Card is marked Closed.
   │   JOB CARD   │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │  CONVERT TO  │   One click. Creates the tax invoice.
   │    SALES     │   Advance already paid is carried across.
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │  BILL 85935  │   Customer pays the balance. Print & hand over.
   └──────────────┘
```

You can also **skip the job card** and make a bill directly — see section 8.

---

## 6. Dashboard

The first screen after signing in. Four boxes across the top:

```
  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
  │ TODAY'S SALES │ │ MONTH SALES   │ │ OPEN JOB CARDS│ │  CUSTOMERS    │
  │   0.00 AED    │ │   0.00 AED    │ │       0       │ │       9       │
  │ 0 bills today │ │0 bills a month│ │ awaiting work │ │ledgers on file│
  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

Below that:

- **Recent Job Cards** — the latest orders, click any row to open it
- **Low Stock** — any product under 10 units, so you know what to re-order

Nothing is edited here. It is a read-only summary.

---

## 7. Taking an order — the Job Card

Click **New Job Card**. The card number fills in automatically, continuing from
the old system (next one is **13259**).

The screen has five areas, top to bottom:

```
  ┌────────────────────────────────────────────────────────────┐
  │ (1) HEADER     No · Book No · Ref · Date · Delivery Date    │
  ├────────────────────────────────────────────────────────────┤
  │ (2) CUSTOMER   Name · Phone     [search button]            │
  ├────────────────────────────────────────────────────────────┤
  │ (3) ITEMS      Code │ Item │ Qty │ Rate │ Amount           │
  │                ─────┼──────┼─────┼──────┼────────          │
  │                5001 │ARABI │  2  │138.10│ 276.20           │
  │                                   Total → 276.20           │
  │                                   Tax 5% →  13.81          │
  │                                   NET    → 290.01          │
  ├────────────────────────────────────────────────────────────┤
  │ (4) MEASUREMENTS   LEN │ CHEST │ COLLAR │ WRIST │ ...      │
  ├────────────────────────────────────────────────────────────┤
  │ (5) PAYMENT    Advance │ Balance │ Cash/Bank/Card          │
  └────────────────────────────────────────────────────────────┘
```

### Step by step

**1 — Pick the customer**

Two ways:

- *Existing customer:* click the small search button next to the name box
  (or press **F2**). A list opens. Type part of the name or phone, click the
  right one. Name and phone fill in automatically.
- *Walk-in customer:* just type the name and phone directly. Nothing is added
  to your customer list.

**2 — Add the items**

In the Code box, type the product code (e.g. `5001`) or press **F2** to search
by name. Pick the item — the name and rate fill in automatically.

Type the **Qty**. The Amount calculates itself. Click **＋ Add row** for more
items.

> The totals at the bottom update on their own. You never type the tax or the
> net amount — the system works it out, so the numbers can never be wrong.

**3 — Enter measurements, one block per person**

One customer often brings work for several people — himself, his sons, a
brother. Each one gets their own block.

Press **＋ Add person**, type their name, and fill the grid: LEN, HAND, SHOUL,
CHEST, COLLAR, B.LOOSE, WRIST, K.CHEST, BOTTOM, WEST, A, H.LOOS, H.KASHF,
T.R., K., Q. Fill only the ones you use; blanks are ignored. Set **Qty** for how
many pieces that person is having stitched.

Each block also has its own Fabric and Size, and a small arrow to fold it shut
so a four-person order stays readable.

**Everyone is kept on file.** Leave *Keep … on file for next time* ticked and
that person is saved under this customer:

```
   Saved for this customer
   ☑ Amu Bokhit   ☑ Omar   ☑ Yusuf   ☑ Khalid
   Tick only the people being stitched for this time.
```

**Next visit**, the same row of names appears as soon as you pick the customer.
If he only wants two thobes this time instead of four, tick just those two —
the other two stay on file, untouched, ready for the visit after. Nobody is
ever re-measured.

The **×** beside a name removes that person from the customer for good.

**4 — Materials used** *(optional)*

If you issue fabric or buttons against this order, list them here. This is for
your own costing record.

**5 — Take the advance**

Type the amount the customer is paying now in **Advance**, and choose Cash,
Bank or Card. The **Balance** updates instantly.

**6 — Save**

Click **Save**. The order is stored and the card number is now locked in.

---

## 8. After the order is saved

Open any job card from the **Job Cards** list. You now have extra buttons:

```
   ┌─────────────────┬──────────────────┬───────────────────────┐
   │  Part Payment   │ Payment History  │  Convert to Sales →   │
   └─────────────────┴──────────────────┴───────────────────────┘
                     ☐ Closed
```

**Part Payment** — customer pays more before collection. Enter the amount and
method. The balance drops. You can do this as many times as you like.

**Payment History** — shows every payment taken against this card, with date
and method.

**Closed tick box** — tick it when the stitching is done. Untick it (**Reopen**)
if work needs to restart.

**‹‹ ›› arrows** — jump to the previous or next job card without going back to
the list.

**Convert to Sales →** — the final step. See below.

---

## 9. Turning the order into a bill

Press **Convert to Sales →** on a finished job card.

```
   JOB CARD 13259                      SALES BILL 85935
   ─────────────────                   ─────────────────
   Items            ──────────────▶    Same items
   Net 290.01       ──────────────▶    Net 290.01
   Advance 150.00   ──────────────▶    Advance 150.00  (carried over)
                                       ─────────────────
                                       BALANCE DUE 140.01
   Status: CONVERTED
```

What happens:

- A new bill number is created (next one is **85935**)
- All items, amounts and tax copy across exactly
- Any advance already collected is deducted automatically
- The job card is marked **Converted** and can no longer be edited

The customer pays the remaining balance, and you print the invoice.

> A job card can only be converted **once**. If you try again the app will stop
> you.

---

## 10. Selling without a job card

For a straight over-the-counter sale (ready stock, fabric by the metre), click
**New Sale** instead.

```
  ┌────────────────────────────────────────────────────────────┐
  │  Bill No 85935        Date          [🖨 Print] [Save Bill]  │
  ├────────────────────────────────────────────────────────────┤
  │  Retail │ Wholesale │ Distributor      Cash │ Credit        │
  │  Category A │ B                     ☐ Return mode          │
  ├────────────────────────────────────────────────────────────┤
  │  Customer          [search]     Salesman                   │
  ├────────────────────────────────────────────────────────────┤
  │  Code │ Item │ Qty │ Rate │ Disc% │ Tax% │ Net             │
  ├────────────────────────────────────────────────────────────┤
  │                         Gross · Discount · Tax · NET       │
  └────────────────────────────────────────────────────────────┘
```

Choose the price level (**Retail / Wholesale / Distributor**), whether it is
**Cash or Credit**, add the items, then **Save Bill**.

**🖨 Print** opens a clean, print-ready tax invoice — no menus, no buttons, just
the invoice. Use your browser's "Save as PDF" if you need to email it.

### Doing a return

Tick **Return (sales return mode)** before saving. The bill is recorded as a
return (goods coming back, money going out) instead of a sale.

---

## 11. Ledgers — your customer and supplier list

Every person or company you deal with. Three types:

- **Customer** — people who order garments
- **Supplier** — fabric and material companies
- **General** — anything else

Search by name or phone at the top. **＋ New Ledger** to add one.

Each entry holds: name, phone, address, TRN (tax number), opening balance.

> If someone cannot see the Edit and Delete buttons here, and instead sees
> "View only", that is their permission level — they can look up customers but
> not change them.

---

## 12. Products — what you sell and what it costs

Each product has:

| Field | Meaning |
|---|---|
| **Code** | Short number you type at the counter (e.g. `5001`) |
| **Name** | ARABI BIG, KUWAITI BIG, LUBBAN … |
| **Rate** | Normal retail price |
| **Wholesale rate** | Price used when the bill is set to Wholesale |
| **Category** | Stitching, Fabric or Material |
| **Unit** | PCS, MTR … |
| **Stock qty** | How many you have |

Anything below **10 units** appears in the Low Stock box on the Dashboard.

> Stock is a reminder only at the moment — selling an item does not reduce the
> number automatically. You adjust it yourself.

---

## 13. Payments — where the money went

One table showing **every advance and part payment** collected across all job
cards, with three summary boxes:

```
  ┌────────────────────┐ ┌──────────────┐ ┌──────────────┐
  │  TOTAL COLLECTED   │ │     CASH     │ │     CARD     │
  │     0.00 AED       │ │   0.00 AED   │ │   0.00 AED   │
  └────────────────────┘ └──────────────┘ └──────────────┘
```

Use this at closing time to match the cash drawer against the system.

---

## 14. Users — adding your staff

Only Super Admin and Admin can open this screen.

**To add someone:**

1. Click **＋ New User**
2. Fill in full name, a username (lowercase, no spaces), and a password
   (at least 8 characters)
3. Choose the role — this ticks a sensible starting set of abilities
4. Adjust the tick boxes if you want to
5. **Create user**

```
   ┌─ New user ──────────────────────────────────────────────┐
   │  Full name [__________]    Username [__________]        │
   │  Password  [__________]    Role     [ Salesman  ▾]      │
   │  ☑ Account is active (can sign in)                      │
   ├─────────────────────────────────────────────────────────┤
   │  Permissions                9 of 17 granted             │
   │                                                         │
   │  DASHBOARD            JOB CARDS                         │
   │   ☑ View dashboard     ☑ View job cards                 │
   │                        ☑ Create job cards               │
   │  SALES                 ☑ Edit job cards                 │
   │   ☑ View sales         ☑ Take payments / advances       │
   │   ☑ Create sales       ☐ Close & reopen                 │
   │                        ☐ Convert to sale                │
   └─────────────────────────────────────────────────────────┘
```

**To stop someone working** (left the job, on leave): open them and untick
**Account is active**. They cannot sign in, but all their past job cards and
bills stay in the system. This is better than deleting.

**Changes apply immediately.** If you untick an ability while that person is
using the app, they lose it on their very next click — they do not have to sign
out and in again.

### Safety rules the app enforces

You cannot lock yourself or the business out, no matter what you click:

- An Admin cannot create, edit or delete a Super Admin
- Nobody can delete, deactivate, or change the role of their **own** account
- The **last** Super Admin cannot be removed

---

## 15. Settings

| Setting | What it does |
|---|---|
| **VAT / Tax rate** | The % applied to bills. UAE standard is 5. |
| **Default book no** | Pre-filled on every new job card |
| **Default salesman** | Pre-filled on every new bill |
| **Delivery days** | Delivery date = today + this many days |

> These are saved **on the device you are using**. The shop counter PC and your
> laptop can each have their own defaults.

---

## 16. How the money is worked out

You never calculate anything by hand. This is what happens behind the counter:

```
        Item amounts added up        →   TOTAL        276.20
        minus any discount           →   DISCOUNT       0.00
                                         ─────────────────────
        plus 5% VAT on the rest      →   TAX           13.81
                                         ─────────────────────
                                         NET AMOUNT   290.01

        minus what the customer      →   ADVANCE      150.00
        has already paid                 ─────────────────────
                                         BALANCE DUE  140.01
```

The advance is also split internally into its before-tax part and its tax part,
so your VAT return stays correct even on part payments.

All of this is calculated by the system, not by the browser — so two staff on
two computers can never produce different totals for the same order.

---

## 17. Numbering

| | Continues from | Next one |
|---|---|---|
| Job cards | the old PAC system | **13259** |
| Sales bills | the old PAC system | **85935** |

Numbers are given out automatically when you save, and never repeat.

---

## 18. Daily routine

**Morning**
1. Start the app, open http://localhost:3000
2. Sign in
3. Glance at the Dashboard — open job cards, low stock

**During the day**
- New order → **New Job Card** → take advance → Save
- Customer paying more → open the card → **Part Payment**
- Work finished → tick **Closed**
- Customer collecting → **Convert to Sales** → take balance → **Print**
- Walk-in cash sale → **New Sale** → Save Bill → Print

**Evening**
1. **Payments** screen → check total collected against the cash drawer
2. **Job Cards** → filter by Open → see what is still pending
3. Close the browser (the app keeps running until you stop the terminal)

---

## 19. If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| "Incorrect username or password" | Typed wrong, or caps lock on | Check capitals. Ask an Admin to reset it. |
| "This account has been deactivated" | An Admin switched the account off | Ask an Admin to tick "Account is active". |
| "Your session has expired" | Signed in more than 12 hours ago | Sign in again. Nothing is lost. |
| "You don't have permission to do that" | Your account lacks that ability | Ask a Super Admin to tick it on the Users screen. |
| Menu items are missing | Same as above — you only see what you can use | Normal. Ask if you need more access. |
| "Job card already converted to sales" | It has already been billed once | Find the bill under Sales / Return. |
| Page will not load at all | The app is not running | Restart it in the terminal. |

---

## 20. Things to know

- **Nothing is ever deleted quietly.** Converting a job card keeps the job card;
  it just marks it as converted.
- **Deactivate, don't delete, staff.** Their history stays linked.
- **The data lives online** (MongoDB Atlas), not on one PC — so the same
  information appears on every device that opens the app.
- **Change the starter passwords.** `superadmin`, `admin` and `salesman` all
  ship with known passwords. Change or remove them before real trading.
