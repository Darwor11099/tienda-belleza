import { SearchIcon } from "@/components/layout/icons";

type Props = { id: string; defaultValue?: string; className?: string; hidden?: Record<string, string> };

/** Funciona sin JavaScript: envía ?q= al catálogo. */
export function SearchForm({ id, defaultValue, className = "", hidden = {} }: Props) {
  return (
    <form action="/catalogo" method="get" role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">Buscar por nombre o referencia</label>
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={60}
        placeholder="Buscar por nombre o referencia"
        autoComplete="off"
        className="h-11 w-full rounded-full border border-input bg-card pr-12 pl-5 text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" aria-label="Buscar" className="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
