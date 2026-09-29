import type { Metadata } from "next";
import { BulletinsPage } from "@/components/pages/bulletins-page";

export const metadata: Metadata = { title: "Bulletins" };

export default function Page() {
  return <BulletinsPage />;
}
