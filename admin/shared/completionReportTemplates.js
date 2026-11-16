// Starting points only. Selecting a template never attests that work was done.
// Staff must edit the list for the actual job and explicitly tick completed tasks.
export const COMPLETION_REPORT_TEMPLATES = [
  { id: 'carpet', label: 'Carpet cleaning', tasks: [
    'Inspect the agreed carpeted areas and note existing marks or damage',
    'Vacuum the agreed areas', 'Treat identified spots where suitable',
    'Clean the agreed carpeted areas using a suitable method',
    'Check the finished areas and note any remaining marks',
  ], aftercare: 'Allow the carpet to dry before replacing furniture or rugs. Keep the room ventilated where practical and follow the drying advice given by the technician.', exclusions: '' },
  { id: 'upholstery', label: 'Sofa and upholstery cleaning', tasks: [
    'Inspect the booked items and check the fabric before treatment',
    'Vacuum the agreed upholstery', 'Treat identified spots where suitable',
    'Clean the agreed seats, cushions and other booked surfaces',
    'Check the finished items and note any remaining marks',
  ], aftercare: 'Allow the upholstery to dry fully before use. Keep the room ventilated where practical and follow the fabric-specific advice given by the technician.', exclusions: '' },
  { id: 'end_of_tenancy', label: 'End-of-tenancy cleaning', tasks: [
    'Clean the agreed kitchen surfaces and fittings', 'Clean the oven and other appliances included in the booking',
    'Clean the agreed bathroom surfaces and fittings', 'Clean the agreed bedrooms and living areas',
    'Clean accessible internal windows, frames and sills included in the booking',
    'Vacuum carpets and clean suitable hard floors in the agreed areas',
    'Check the property and record any exclusions or outstanding issues',
  ], aftercare: 'Allow cleaned surfaces to dry before use. Keep this report as a record of the work described; it does not determine the outcome of a tenancy inspection or deposit claim.', exclusions: '' },
  { id: 'hospitality', label: 'Restaurant and hospitality cleaning', tasks: [
    'Record the areas and furnishings included in the job', 'Inspect agreed carpets and upholstery before treatment',
    'Clean the booked seating and soft furnishings using suitable methods',
    'Clean the agreed floor areas', 'Record remaining stains, wear and access limitations',
  ], aftercare: 'Keep treated areas out of use until dry and ready for reopening. Follow the technician’s advice for the surfaces cleaned.', exclusions: '' },
  { id: 'commercial', label: 'Commercial and office cleaning', tasks: [
    'Record the rooms and areas included in the job', 'Clean the agreed accessible surfaces',
    'Clean the booked carpets, upholstery or hard floors using suitable methods',
    'Clean shared facilities where included in the agreed work', 'Check finished areas and record outstanding issues',
  ], aftercare: 'Keep staff and visitors clear of wet surfaces until dry. Follow any access and drying advice given for the treated areas.', exclusions: '' },
  { id: 'communal', label: 'Communal carpet and apartment-block cleaning', tasks: [
    'Record the floors, landings, corridors and stairs included in the job',
    'Inspect carpet condition and identify existing marks or damage',
    'Vacuum and clean the agreed areas using suitable methods',
    'Treat identified spots where suitable', 'Record remaining marks and any areas not accessible',
  ], aftercare: 'Inform residents of any areas still drying and follow the agreed access arrangements. Keep entrances ventilated where safe and practical.', exclusions: '' },
  { id: 'after_builders', label: 'General and after-builders cleaning', tasks: [
    'Record the areas ready and available for cleaning', 'Remove accessible surface dust in the agreed areas',
    'Clean the agreed accessible fixtures, fittings and surfaces',
    'Clean windows and frames where included in the agreed work',
    'Clean suitable floors in the agreed areas', 'Record remaining residue, damage and areas needing further work',
  ], aftercare: 'Allow cleaned surfaces to dry before use. Further building work may create new dust; arrange any additional cleaning separately if needed.', exclusions: '' },
];

export function getCompletionReportTemplate(id) {
  return COMPLETION_REPORT_TEMPLATES.find((template) => template.id === id);
}
