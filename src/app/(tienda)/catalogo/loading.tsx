export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Cargando catálogo">
      <div className="h-12 w-56 animate-pulse rounded-full bg-muted" />
      <div className="mt-8 h-11 max-w-md animate-pulse rounded-full bg-muted" />
      <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <div className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
            <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-5 w-1/3 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}
