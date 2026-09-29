import type { Metadata } from "next";
import { ClassesPage } from "@/components/pages/classes-page";

export const metadata: Metadata = { title: "Classes" };

export default function Page() {
  return <ClassesPage />;
}
