import { ReactNode } from "react";

/**
 * Content width wrapper. Centers content with consistent horizontal padding.
 * Use as the immediate child of any <section> or <main> block.
 */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
