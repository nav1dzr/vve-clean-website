// Single server-side source of business/document identity used by invoice
// and receipt PDFs and emails. See INVOICE_RECEIPT_IMPLEMENTATION_PLAN.md
// §3 and admin/INVOICES_SETUP.md for the full rationale.
//
// IMPORTANT — do not guess: registered office address, bank/payment
// details, and VAT registration status do not exist anywhere in this
// repository (confirmed by inspection before this file was written; see
// BUSINESS_DECISIONS_REQUIRED.md). They are read from environment
// variables here, left unset by default, and every caller (PDF layout,
// email template) must handle them being absent — a missing bank-details
// block or VAT row is the correct behaviour until an owner configures
// these on the admin Vercel project, never a guessed default value.
//
// vatEnabled defaults to false and must stay false unless an owner
// explicitly sets INVOICE_VAT_ENABLED=true after confirming VAT
// registration — no invoice/receipt template may print a VAT row, VAT
// number, or "not VAT registered" wording unless this flag is true.

export function getBusinessSettings() {
  return {
    legalName: 'VVE Limited',
    tradingName: 'VVE Clean',
    companyNumber: '17234391',
    // Not present anywhere in the repo — must be set before first real
    // invoice is issued. See admin/INVOICES_SETUP.md.
    registeredAddress: process.env.INVOICE_BUSINESS_ADDRESS || null,
    phone: '020 8050 2233',
    email: 'contact@vveclean.co.uk',
    website: 'www.vveclean.co.uk',

    // Payment instructions block — omitted entirely from PDFs/emails
    // unless both are set.
    bankAccountName: process.env.INVOICE_BANK_ACCOUNT_NAME || null,
    bankSortCode: process.env.INVOICE_BANK_SORT_CODE || null,
    bankAccountNumber: process.env.INVOICE_BANK_ACCOUNT_NUMBER || null,
    // Free-text instructions for what a customer should use as their
    // payment reference (e.g. "Please use your invoice number as
    // reference"). Optional — shown alongside bank details when set, never
    // fabricated when unset.
    bankReferenceInstructions: process.env.INVOICE_BANK_REFERENCE_INSTRUCTIONS || null,

    // VAT — disabled by default; see file header. Never inferred from any
    // other signal (price, customer type, etc).
    vatEnabled: process.env.INVOICE_VAT_ENABLED === 'true',
    vatNumber: process.env.INVOICE_VAT_NUMBER || null,

    currency: 'GBP',
    currencySymbol: '£',

    defaultPaymentTermsDays: 14,
    defaultPaymentTermsText: 'Payment due within 14 days of the invoice date.',

    invoicePrefix: 'INV',
    receiptPrefix: 'REC',

    emailFromName: 'VVE Clean',
    emailSignature: 'The VVE Clean Team',
  };
}

export function hasBankDetails(settings) {
  return Boolean(settings.bankAccountName && settings.bankSortCode && settings.bankAccountNumber);
}
