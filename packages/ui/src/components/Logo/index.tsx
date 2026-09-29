export interface LogoProps {
  /** Logo asset path. Defaults to the horizontal light lockup in the app's public assets. */
  src?: string;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
}

/** Holy Makkah Municipality logo lockup. Renders a plain <img> (framework-agnostic). */
export default function Logo({
  src = "/figma-assets/logos/logo-horizontal-light-3.png",
  width,
  height,
  alt = "أمانة العاصمة المقدسة — Holy Makkah Municipality",
  className,
}: LogoProps) {
  return <img src={src} width={width} height={height} alt={alt} className={className} />;
}
