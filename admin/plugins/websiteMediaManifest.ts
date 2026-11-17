import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Match the website's virtual gallery manifest; never maintain a second photo list. */
export function websiteMediaManifest() {
  const id = "virtual:eot-gallery";
  const resolved = `\0${id}`;
  return {
    name: "crm-website-media-manifest",
    resolveId(source: string) { return source === id ? resolved : undefined; },
    load(source: string) {
      if (source !== resolved) return undefined;
      const directory = fileURLToPath(new URL("../../public/end_of_tenancy/gallery/", import.meta.url));
      const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
      const images = readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && /\.(avif|jpe?g|png|webp)$/i.test(entry.name))
        .map(entry => entry.name).sort(collator.compare).slice(0, 15)
        .map(name => `/end_of_tenancy/gallery/${encodeURIComponent(name)}`);
      return `export default ${JSON.stringify(images)};`;
    },
  };
}
