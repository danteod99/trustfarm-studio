import Link from "next/link";
import { BRAND } from "@/app/lib/brand";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-sm text-white">
        ▶
      </span>
      <span>
        {BRAND.short}
        <span className="text-brand-2"> Studio</span>
      </span>
    </Link>
  );
}
