# Observed valuation and Expiration Payoff are separate

Status: accepted

Mark-to-Market Valuation answers what the held Position was worth on an actual U.S. trading date and requires exact effective Marks. Expiration Payoff answers how a co-expiring option structure settles as a piecewise-linear function of underlying price at expiration. Neither is a substitute for the other.

Theoretical option pricing and a fabricated single curve for mixed expirations were rejected. The application does not project tomorrow's option value or require volatility, rate, or dividend assumptions. Mixed-expiration payoff is explicitly unavailable in the MVP, while dated Mark-to-Market Valuation remains available when its observations are complete.

Consequences include two independently available Planned and Current payoff views, explicit gaps rather than fill-cost substitution, and honest `Unavailable` or `Not Applicable` results when the method or evidence cannot support a number.
