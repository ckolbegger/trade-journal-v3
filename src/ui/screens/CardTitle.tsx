import type { ComponentProps } from 'react';

// A card's heading: the page already has its h1.
export function CardTitle(props: ComponentProps<'h3'>) {
  return <h3 {...props} />;
}
