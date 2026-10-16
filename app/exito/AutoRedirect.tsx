"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRedirect({ to, delay = 1400 }: { to: string; delay?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace(to), delay);
    return () => clearTimeout(timer);
  }, [router, to, delay]);

  return null;
}
