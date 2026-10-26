// The Trade summary text; the "@" stays with its price when the text wraps.
export function TradeText({ text }: { readonly text: string }) {
  const at = text.indexOf('@ ');
  if (at < 0) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, at)}
      <span className="nowrap">{text.slice(at)}</span>
    </span>
  );
}
