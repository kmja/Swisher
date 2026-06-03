/**
 * Official Swish logo (rainbow swirl + "swish®" wordmark) used inside
 * the pay button when Swish is the chosen payment method. Public asset
 * lives at /swish-logo.png — the dark-background variant Swish ships in
 * their brand kit. Per Swish's guidelines we don't crop / stretch / re-
 * colour it, so the component only takes a height and computes width
 * from the file's intrinsic 1734 × 528 aspect ratio.
 */
export default function SwishLogo({
  height = 24,
  className = "",
  alt = "Swish",
}: {
  height?: number;
  className?: string;
  alt?: string;
}) {
  const width = Math.round(height * (1734 / 528));
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/swish-logo.png"
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ height: `${height}px`, width: `${width}px` }}
    />
  );
}
