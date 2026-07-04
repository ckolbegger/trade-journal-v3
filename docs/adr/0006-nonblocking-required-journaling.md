# Required journaling is non-blocking (Journal Debt)

Journal Entries are required at Plan confirmation, Plan Revision, and Position close — but the requirement never blocks executing an order or moving to another position. The trader may skip or accept a timestamped "TBD" placeholder, creating Journal Debt that Daily Review surfaces for settlement outside trading hours. Blocking modals were rejected because reflection forced at market speed produces garbage and resentment; fully optional journaling was rejected because the record goes thin exactly where discipline failed.
