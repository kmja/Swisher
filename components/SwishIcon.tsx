/** Compact stylised "Swish" badge for the pay button: a flowing S on a
 *  white capsule. We can't ship the official Swish trademark, but the
 *  shape + colour combination reads as "Swish" inside a swish-pink CTA
 *  while staying our own asset.
 *
 *  Sized via `size` so the same component scales nicely whether it sits
 *  inline in a button or larger on a marketing surface. */
export default function SwishIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="#ffffff" />
      <path
        d="M22 10c-2-2.4-5-3.4-8-2.6-2.7.7-4.4 2.7-4 5 .4 2.4 2.6 3.3 6.4 4.3 4 1 6 2 6.4 4.3.4 2.3-1.3 4.3-4 5-3 .8-6 -.2-8-2.6"
        fill="none"
        stroke="#ee5c9a"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
