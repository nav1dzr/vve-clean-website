import { AFTER_BUILDERS_FROM_PRICES_P, DEPOSIT_P, penceToDisplay } from './pricing';
import { CANCELLATION_NOTICE, LATE_CHANGE_NOTICE } from './businessPolicy';

export const BUILDERS_WHATSAPP =
  'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20an%20after-builders%20clean%20quote.%20Sending%20photos%20now.';

// These are existing catalogue starts, not a new tariff or a final quotation.
export const BUILDERS_PRICES = [
  {
    key: 'small',
    label: 'Small renovation / one main area',
    pence: AFTER_BUILDERS_FROM_PRICES_P.small,
    note: 'Tell us which area was renovated and whether dust has spread to other rooms.',
  },
  {
    key: 'studio',
    label: 'Studio flat',
    pence: AFTER_BUILDERS_FROM_PRICES_P.studio,
    note: 'The layout, bathroom and kitchen condition help us confirm the work needed.',
  },
  {
    key: 'bed1',
    label: '1-bedroom property',
    pence: AFTER_BUILDERS_FROM_PRICES_P.bed1,
    note: 'Send room photos, the number of bathrooms and any additional living areas.',
  },
  {
    key: 'bed2',
    label: '2-bedroom property',
    pence: AFTER_BUILDERS_FROM_PRICES_P.bed2,
    note: 'Floor area, residue and access matter as well as the bedroom count.',
  },
  {
    key: 'bed3',
    label: '3-bedroom property',
    pence: AFTER_BUILDERS_FROM_PRICES_P.bed3,
    note: 'Include bathrooms, stairs, extra rooms and the extent of the building work.',
  },
  {
    key: 'bed4',
    label: '4-bedroom property',
    pence: AFTER_BUILDERS_FROM_PRICES_P.bed4,
    note: 'Larger layouts or complex finishes may need plans or a site assessment.',
  },
];

// One source for the visible FAQ and FAQPage structured data.
export const BUILDERS_FAQS = [
  {
    q: 'How much does after-builders cleaning cost, and is the quote fixed?',
    a: `Our current starting prices run from ${penceToDisplay(AFTER_BUILDERS_FROM_PRICES_P.small)} for a small renovation or one main area to ${penceToDisplay(AFTER_BUILDERS_FROM_PRICES_P.bed4)} for a four-bedroom property. These are starting points, not final prices. We review the size, condition, surfaces and access, then agree a fixed written quote for the cleaning list. We do not sell this as an hourly cleaning service. No VAT is added. Larger or more complex projects need an individual assessment.`,
  },
  {
    q: 'What should I send for an accurate quote?',
    a: 'Send your postcode, property size, number of bathrooms, the work carried out and your preferred cleaning or handover date. Include a wide photo of each affected room and close-ups of dust, paint, plaster or adhesive. Tell us about stairs, lifts, parking and delicate finishes. Plans or a site assessment may help with larger projects. You can send photos on WhatsApp; please avoid including people or personal documents.',
  },
  {
    q: 'What does the cleaning include?',
    a: 'Your written quote lists the rooms, surfaces and tasks we agree to clean. This can include construction dust on reachable surfaces, empty cupboards, internal windows, kitchen and bathroom fittings, and floors. The checklist on this page helps you tell us what you need; it is not a promise that every task is included in every price. We agree any extra work or change in price with you before carrying it out.',
  },
  {
    q: 'What is the difference between a builders clean and a sparkle clean?',
    a: 'An initial builders clean deals with the heavier mess left during or after works. A standard after-builders clean focuses on settled dust and the agreed rooms and surfaces once the work is finished. A final sparkle clean is a finishing visit close to handover, usually after the main clean. These terms vary between companies, so we agree the actual tasks and number of visits rather than relying on the label.',
  },
  {
    q: 'When should I book, and can builders still be working?',
    a: 'Plan the final clean after the trades have finished their work and removed tools and building waste. Tell us if decorating, sanding or other work will continue, as it can put fresh dust on cleaned surfaces. We will discuss a suitable date around your completion plans. A further visit is not automatically included if more work takes place afterwards.',
  },
  {
    q: 'How long will the clean take?',
    a: 'There is no reliable duration based on bedrooms alone. The amount of dust, residue, glazing, fitted storage and access all affect the time needed. We discuss the likely duration and whether more than one visit is needed when we assess the property. Let us know any access hours or handover deadline before accepting the quote.',
  },
  {
    q: 'Do I need to provide products, equipment, water or electricity?',
    a: 'We bring the cleaning products and equipment for the agreed work. Please arrange working water and electricity, safe access, and access to the rooms being cleaned. Tell us before booking if utilities are not connected or the site has access restrictions. Empty cupboards and clear personal belongings where you want interior cleaning.',
  },
  {
    q: 'Can you remove paint, plaster, silicone, adhesive and grout haze?',
    a: 'We assess the residue and the surface before agreeing treatment. Paint, sealant, grout haze and adhesives can need different methods, particularly on glass, natural stone, timber and newly finished surfaces. We cannot guarantee complete removal or repair scratches, etching, staining or other permanent damage. Send close-up photos and any surface-care instructions so we can discuss what is suitable.',
  },
  {
    q: 'Are walls, ceilings, high areas and building waste included?',
    a: 'Wall and ceiling cleaning depends on the finish, drying or curing requirements and safe access. High areas must be assessed before inclusion. Please arrange for your builders to remove rubble, off-cuts, tools and excess waste before the clean; building-waste clearance is not included in our standard cleaning quote. Tell us about anything unusual or potentially hazardous before booking.',
  },
  {
    q: 'Can I add carpet, sofa or exterior window cleaning?',
    a: 'Ask us to include these in the assessment. Carpet and upholstery extraction are separate from ordinary vacuuming, and exterior windows are separate from internal glazing. We confirm suitable treatments, access and any extra cost before booking. If wet cleaning is agreed, we explain the drying considerations for the material and conditions rather than promising one drying time for every job.',
  },
  {
    q: 'How do parking and congestion charges work?',
    a: 'Tell us about a permit or free parking near the property, and any restrictions on unloading equipment. Where paid parking or a congestion charge applies, we explain it as a separate access cost before you accept the quote. Parking is charged at actual cost; an allowance is an estimate, not an extra cleaning service. Please also mention stairs, no lift or restricted entry times.',
  },
  {
    q: 'When do I pay the deposit and balance?',
    a: `There is no payment to send a quote request. Once we agree the cleaning list, final price and time, we email your booking details and payment options. The ${penceToDisplay(DEPOSIT_P)} booking deposit normally secures the appointment and is deducted from your total. Your booking is confirmed when the deposit is received. The remaining balance is due on the day of the clean, as set out in your booking details.`,
  },
  {
    q: 'What if the builders are delayed or I need to change the date?',
    a: `${CANCELLATION_NOTICE} If your works are running late, tell us as soon as possible so we can discuss another available date. ${LATE_CHANGE_NOTICE}`,
  },
  {
    q: 'Are you insured, and is there an after-builders re-clean guarantee?',
    a: 'VVE Clean has £5 million public liability insurance. The re-clean guarantee advertised for End of Tenancy Cleaning does not automatically apply to after-builders work. We check the completed work against the agreed cleaning list. If you have a concern, contact us so we can review it against that list and your booking terms.',
  },
];

// Each category describes possible quoted tasks, not universal inclusions.
export const BUILDERS_ROOMS = [
  {
    title: 'Bedrooms & living areas',
    summary: 'Agree the rooms and reachable surfaces that need attention after the works.',
    tasks: [
      'Dust removal from accessible shelves, ledges and other agreed surfaces',
      'Empty built-in wardrobes and cupboard interiors',
      'Reachable radiators, switches and light fittings',
      'Suitable dust removal from walls where the finish allows it',
    ],
    assessment: 'Only quoted tasks are included. Fresh paint, ceilings, high fittings and delicate finishes need assessment; cleaning does not repair scuffs or damage.',
  },
  {
    title: 'Kitchens & fitted units',
    summary: 'Choose the units, fittings and appliances to include in your cleaning list.',
    tasks: [
      'Empty cabinet and drawer interiors, fronts and handles',
      'Suitable worktops, splashbacks, sinks and taps',
      'Accessible appliance exteriors and cupboard tops',
      'Selected unused appliance interiors for construction dust',
    ],
    assessment: 'Only quoted tasks are included. Used ovens and other appliance deep cleaning are assessed separately. Tell us about stone, high-gloss finishes and protective films.',
  },
  {
    title: 'Bathrooms & shower rooms',
    summary: 'Confirm the bathrooms and newly installed fittings that need cleaning.',
    tasks: [
      'Baths, shower trays, basins and toilets',
      'Taps, mirrors, shower screens and accessible fittings',
      'Suitable tiles and grout surfaces',
      'Empty bathroom cabinets and reachable towel rails',
    ],
    assessment: 'Only quoted tasks are included. Grout haze, silicone smears, cement and residue on natural stone need a separate surface assessment; full removal is not guaranteed.',
  },
  {
    title: 'Internal windows & glass',
    summary: 'List the reachable internal panes, frames and glass surfaces in the quote.',
    tasks: [
      'Reachable internal window glass and mirrors',
      'Window frames, sills and accessible tracks',
      'Suitable internal glazed doors and glass panels',
      'Protective sticker or tape residue where assessed as safe to treat',
    ],
    assessment: 'Only quoted tasks are included. Exterior windows, high glazing and difficult access are separate. Glass coatings, scratches and firmly bonded residue need assessment.',
  },
  {
    title: 'Doors, woodwork & details',
    summary: 'Identify the finishing details that have collected dust around the property.',
    tasks: [
      'Doors, frames and handles',
      'Skirting boards and architraves',
      'Reachable ledges, fittings and accessible radiator surfaces',
      'Agreed joinery and built-in storage exteriors',
    ],
    assessment: 'Only quoted tasks are included. Unsealed timber, fresh coatings, intricate detailing and marks that may be permanent need assessment before treatment.',
  },
  {
    title: 'Floors, stairs & access areas',
    summary: 'Agree which floors, stairs and connecting areas are part of the clean.',
    tasks: [
      'Vacuuming agreed floor areas and accessible edges',
      'Suitable damp cleaning of hard floors',
      'Stair treads, accessible risers and handrails',
      'Thresholds and agreed hallways or landings',
    ],
    assessment: 'Only quoted tasks are included. Carpet extraction, floor polishing or sealing and heavy residue treatment are separate assessments. Builders must remove tools and building waste first.',
  },
];
