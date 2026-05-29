/** Centred wordmark used as the page header on every screen. The dot in the
 *  brand pink doubles as a "this is the home" affordance — the whole logo is
 *  a link back to the start page. */
export default function KvittLogo({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      aria-label="Kvitt"
      className={`inline-flex items-center justify-center text-base font-extrabold tracking-tight text-ink active:opacity-80 ${className}`}
    >
      Kvitt<span className="ml-px text-swish">.</span>
    </a>
  );
}
