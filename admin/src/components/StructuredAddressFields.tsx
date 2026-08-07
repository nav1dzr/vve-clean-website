interface StructuredAddressFieldsProps {
  address: string;
  postcode: string;
  onAddressChange: (value: string) => void;
  onPostcodeChange: (value: string) => void;
  legend?: string;
  idPrefix: string;
}

function splitAddress(address: string) {
  const [line1 = '', line2 = '', ...townParts] = address.split(/\r?\n/);
  return { line1, line2, town: townParts.join(' ').trim() };
}

function joinAddress(line1: string, line2: string, town: string) {
  if (!line2 && !town) return line1;
  return [line1, line2, town].join('\n');
}

export default function StructuredAddressFields({
  address,
  postcode,
  onAddressChange,
  onPostcodeChange,
  legend = 'Address',
  idPrefix,
}: StructuredAddressFieldsProps) {
  const parts = splitAddress(address);
  const inputClass = 'min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 text-base text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
  const labelClass = 'mb-1 block text-sm font-medium text-navy-900';

  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-2 text-sm font-semibold text-navy-950">{legend}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2" htmlFor={`${idPrefix}-line-1`}>
          <span className={labelClass}>Address line 1</span>
          <input
            id={`${idPrefix}-line-1`}
            type="text"
            autoComplete="address-line1"
            value={parts.line1}
            onChange={(event) => onAddressChange(joinAddress(event.target.value, parts.line2, parts.town))}
            className={inputClass}
          />
        </label>
        <label htmlFor={`${idPrefix}-line-2`}>
          <span className={labelClass}>Address line 2</span>
          <input
            id={`${idPrefix}-line-2`}
            type="text"
            autoComplete="address-line2"
            value={parts.line2}
            onChange={(event) => onAddressChange(joinAddress(parts.line1, event.target.value, parts.town))}
            className={inputClass}
          />
        </label>
        <label htmlFor={`${idPrefix}-town`}>
          <span className={labelClass}>Town or city</span>
          <input
            id={`${idPrefix}-town`}
            type="text"
            autoComplete="address-level2"
            value={parts.town}
            onChange={(event) => onAddressChange(joinAddress(parts.line1, parts.line2, event.target.value))}
            className={inputClass}
          />
        </label>
        <label htmlFor={`${idPrefix}-postcode`}>
          <span className={labelClass}>Postcode</span>
          <input
            id={`${idPrefix}-postcode`}
            type="text"
            autoComplete="postal-code"
            value={postcode}
            onChange={(event) => onPostcodeChange(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
    </fieldset>
  );
}
