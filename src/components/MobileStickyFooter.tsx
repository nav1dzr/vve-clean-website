import MobileActionDock from './MobileActionDock';

// Compatibility shim. The real implementation — shared with every other
// bottom action surface on the site — now lives in MobileActionDock.tsx.
// No page imports this file anymore; kept only in case something outside
// this phase still references it.
export default function MobileStickyFooter() {
  return <MobileActionDock variant="calculator" />;
}
