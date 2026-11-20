import "./landing.css";
// Campaign landing pages: no site header, footer or estateAI launcher (lib/site-chrome.ts "landing").
export const metadata = { robots: { index: false, follow: false } };
export default function LandingLayout({ children }: { children: React.ReactNode }) { return children; }
