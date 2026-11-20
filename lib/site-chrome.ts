// Which frame a page gets (components/SiteFrame.tsx). The administration panel brings its own shell
// (app/yonetim/layout.tsx) and the service directory is a sub-site with its own header and footer
// (app/hizmetler/layout.tsx), as is the contractor directory (app/muteahhitler/layout.tsx); every other page gets the real-estate header, footer, currency bar,
// comparison tray and estateAI launcher.
export type SiteChrome = "main" | "admin" | "services" | "contractors" | "landing";
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
export function siteChrome(pathname: string | null | undefined): SiteChrome {
  const path = (pathname || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (under(path, "/yonetim")) return "admin";
  if (under(path, "/hizmetler")) return "services";
  if (under(path, "/muteahhitler")) return "contractors";
  // Campaign pre-registration pages (app/on-kayit) stand alone, without the site frame.
  if (under(path, "/on-kayit")) return "landing";
  return "main";
}
