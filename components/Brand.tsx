// EstateMarket24 logo (public/brand). "negative" is the white version for dark backgrounds:
// the home page header over the hero photo, the footer and the admin panel.
export function Brand({negative=false}:{negative?:boolean}) {
  return <span className="brand-lockup" dir="ltr"><img className="brand-logo" src={negative?"/brand/logo-horizontal-negativ.svg":"/brand/logo-horizontal.svg"} alt="EstateMarket24" width={517} height={100} decoding="async"/></span>;
}
