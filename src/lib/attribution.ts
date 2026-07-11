// Attribution tracking — written to localStorage on source pages, read on booking submit.

export interface AttributionData {
  first_source:    string | null;
  last_source:     string | null;
  landing_page:    string | null;
  offer_code:      string | null;
  discount_percent: number | null;
  utm_source:      string | null;
  utm_medium:      string | null;
  utm_campaign:    string | null;
  utm_content:     string | null;
  gclid:           string | null;
}

const KEYS = {
  first_source:     'vve_first_source',
  last_source:      'vve_last_source',
  landing_page:     'vve_landing_page',
  offer_code:       'vve_offer_code',
  discount_percent: 'vve_discount_percent',
  utm_source:       'vve_utm_source',
  utm_medium:       'vve_utm_medium',
  utm_campaign:     'vve_utm_campaign',
  utm_content:      'vve_utm_content',
  gclid:            'vve_gclid',
};

export function setLeafletAttribution(): void {
  try {
    // first_source is write-once — only set if not already recorded
    if (!localStorage.getItem(KEYS.first_source)) {
      localStorage.setItem(KEYS.first_source, 'leaflet');
    }
    // last_source always reflects the current visit
    localStorage.setItem(KEYS.last_source,      'leaflet');
    localStorage.setItem(KEYS.landing_page,     '/leaflet');
    localStorage.setItem(KEYS.offer_code,       'LEAFLET20');
    localStorage.setItem(KEYS.discount_percent, '20');
    localStorage.setItem(KEYS.utm_source,       'leaflet');
    localStorage.setItem(KEYS.utm_medium,       'qr');
    localStorage.setItem(KEYS.utm_campaign,     'leaflet20');
    localStorage.setItem(KEYS.utm_content,      '');
    // Capture gclid from URL if present (Google click ID)
    const urlGclid = new URLSearchParams(window.location.search).get('gclid');
    if (urlGclid && !localStorage.getItem(KEYS.gclid)) {
      localStorage.setItem(KEYS.gclid, urlGclid);
    }
  } catch { /* ignore — localStorage may be unavailable */ }
}

export function getAttribution(): AttributionData {
  try {
    const pct = localStorage.getItem(KEYS.discount_percent);
    return {
      first_source:     localStorage.getItem(KEYS.first_source),
      last_source:      localStorage.getItem(KEYS.last_source),
      landing_page:     localStorage.getItem(KEYS.landing_page),
      offer_code:       localStorage.getItem(KEYS.offer_code),
      discount_percent: pct !== null ? Number(pct) : null,
      utm_source:       localStorage.getItem(KEYS.utm_source),
      utm_medium:       localStorage.getItem(KEYS.utm_medium),
      utm_campaign:     localStorage.getItem(KEYS.utm_campaign),
      utm_content:      localStorage.getItem(KEYS.utm_content),
      gclid:            localStorage.getItem(KEYS.gclid),
    };
  } catch {
    return {
      first_source: null, last_source: null, landing_page: null,
      offer_code: null, discount_percent: null,
      utm_source: null, utm_medium: null, utm_campaign: null,
      utm_content: null, gclid: null,
    };
  }
}
