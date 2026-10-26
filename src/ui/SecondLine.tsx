// A figure's amount with its R multiple or planned comparison on its own muted line below. Both
// parts stay in one value cell, in reading order ("$1,561.00 6.24R").
export function WithSecondLine({ amount, second }: { readonly amount: string; readonly second: string }) {
  return (
    <>
      <span>{amount}</span> <span className="second-line">{second}</span>
    </>
  );
}
