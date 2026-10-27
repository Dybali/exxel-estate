import type { AnchorHTMLAttributes } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

// Native navigation keeps links usable if the client-side router fails to initialize.
export default function Link({ href, ...props }: Props) {
  return <a href={href} {...props} />;
}
