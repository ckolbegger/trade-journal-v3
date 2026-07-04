# Trader-configurable Entry Types with tolerated schema drift

Every Journal Entry has an Entry Type that defines the Prompts it asks. Both the set of types and each type's Prompts are trader-configurable, seeded with rich defaults. When a type's Prompts change, existing entries are never migrated — each entry permanently keeps the Prompts and answers it was written against, and historical analysis must tolerate entries of the same type having different shapes.

Rejected: a fixed journal schema (the trader's reflection practice evolves faster than the app ships), and migrating old entries on schema change (rewrites history — the answers were given to the old questions, not the new ones).
