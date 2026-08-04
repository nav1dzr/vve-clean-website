// Backend pricing engine — thin re-export shim.
//
// DO NOT ADD OR EDIT PRICES IN THIS FILE.
//
// The single canonical pricing source (data AND calculation logic) is
// ../shared/pricingCatalogue.js. This file exists only so
// api/create-checkout-session.js keeps importing from './servicePrices.js'
// unchanged. Safe because api/ and shared/ sit inside the same Vercel
// project root (the repository root — see vercel.json) — a relative import
// like this one is resolved by Vercel's file-tracing (@vercel/nft) and
// bundled with the function automatically.

export { computePrice } from '../shared/pricingCatalogue.js';
