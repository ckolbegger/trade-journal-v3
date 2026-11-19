import { figureParts } from './figure-parts.ts';

// C9AR.2, A278: a text's words may wrap between figures, never inside one and never between a sign and its number.
export function Words({ text }: { readonly text: string }) {
  return (
    <>
      {figureParts(text).map((part, at) =>
        part.figure ? (
          <span key={at} className="card-figure">
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
