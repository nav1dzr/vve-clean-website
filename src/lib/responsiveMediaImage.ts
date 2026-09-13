const RESPONSIVE_WIDTHS = [480, 768, 1200, 1600, 2400] as const;

function isCloudflareTemplate(url: string) {
  return url.includes('{width}');
}

export function mediaImageUrl(template: string, width: number) {
  return isCloudflareTemplate(template) ? template.replace('{width}', String(width)) : template;
}

export function mediaImageSrcSet(template: string) {
  if (!isCloudflareTemplate(template)) return undefined;
  return RESPONSIVE_WIDTHS.map((width) => `${mediaImageUrl(template, width)} ${width}w`).join(', ');
}

export const managedImageSizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';
