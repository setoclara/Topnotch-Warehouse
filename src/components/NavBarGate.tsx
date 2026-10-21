"use client";

import { usePathname } from "next/navigation";

// The hub pages (welcome screen and the sport placeholders) stand on their own
// and shouldn't show the warehouse navigation.
const HUB_PATHS = ["/", "/tennis", "/pickleball"];

export default function NavBarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (HUB_PATHS.includes(pathname)) return null;
  return <>{children}</>;
}
