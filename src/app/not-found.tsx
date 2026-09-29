import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Cette page n&apos;existe pas.</h1>
      <Link href="/" className="mt-4 text-sm font-medium text-primary">
        Retour au tableau de bord
      </Link>
    </main>
  );
}
