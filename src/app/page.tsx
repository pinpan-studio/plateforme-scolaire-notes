export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-[var(--accent)]">Collège Les Tilleuls</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Cahier de notes</h1>
      <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">
        Saisie des évaluations, calcul des moyennes et consultation des résultats, pour la direction,
        les enseignants et la vie scolaire.
      </p>
      <ul className="mt-10 grid gap-3 text-sm sm:grid-cols-2">
        {[
          "Classes, élèves et affectations",
          "Évaluations et notes par trimestre",
          "Moyennes pondérées et rangs",
          "Bulletins calculés à la demande",
        ].map((item) => (
          <li key={item} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </main>
  );
}
