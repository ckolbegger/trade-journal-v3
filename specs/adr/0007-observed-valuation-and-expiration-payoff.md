# Observed valuation and Expiration Payoff are separate

Status: accepted

Mark-to-Market Valuation answers what the held Position was worth on an actual U.S. trading date and requires exact effective Marks. Expiration Payoff answers how a co-expiring option structure settles as a piecewise-linear function of underlying price at expiration. Neither is a substitute for the other.

Theoretical option pricing and a fabricated single curve for mixed expirations were rejected. The application does not project tomorrow's option value, and no valuation requires volatility, rate, or dividend assumptions. Mixed-expiration payoff is explicitly unavailable in the MVP, while dated Mark-to-Market Valuation remains available when its observations are complete.

Consequences include two independently available Planned and Current payoff views, explicit gaps rather than fill-cost substitution, and honest `Unavailable` or `Not Applicable` results when the method or evidence cannot support a number.

Amended by plan revision 106 (2026-11-17). The application may read an option's implied volatility back from an observed Mark, using the same session's Underlying Mark, the contract's terms and a stated interest rate, to explain a past change in that Mark. That figure, and any figure worked out from it (the Share Equivalent and the Mark Change Split), is an Estimate. An Estimate is labelled as one wherever it shows. It is never a Mark, and it never enters a valuation, a risk or reward figure, a condition's status, a Deviation, a report or a stored fact. The textbook formula is used (Black-Scholes: exercise at expiration only, no dividends), and its limits and assumed rates are stated in the application.
