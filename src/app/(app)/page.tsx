import type { Metadata } from "next";
import { DashboardPage } from "@/components/pages/dashboard-page";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function Page() {
  return <DashboardPage />;
}
