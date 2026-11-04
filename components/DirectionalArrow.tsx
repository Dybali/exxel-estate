import { ArrowLeft, ArrowRight } from "lucide-react";

// "Forward" / "back" arrows for links and buttons. They mirror in Arabic and Persian ([dir=rtl] .dir-arrow
// in app/buttons.css), so link texts carry no literal → / ← characters.
export function ForwardArrow({ size = 15 }: { size?: number }) {
  return <ArrowRight size={size} className="dir-arrow dir-arrow-forward" aria-hidden="true"/>;
}

export function BackArrow({ size = 15 }: { size?: number }) {
  return <ArrowLeft size={size} className="dir-arrow dir-arrow-back" aria-hidden="true"/>;
}
