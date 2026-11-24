import { Fragment } from 'react';

// A signed money figure, as the view wrote it ("−$2,016.00", "+$7.00"). A figure with no sign has no sign to part from, so it stays in the words around it.
const SIGNED_FIGURE = /([−+]\$[\d,]+(?:\.\d+)?)/;

// Words with each signed money figure kept whole: the sign stays with its number at a line end (U2, W90). Text only; nothing is worked out here (ADR 0001).
export function Figures({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(SIGNED_FIGURE).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="nowrap">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
