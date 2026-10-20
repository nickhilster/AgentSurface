# Local dynamic catalogue demo

This small Node.js site demonstrates a website-native, request-time product discovery page. It reads a local JSON catalogue on every request, applies supported query filters, caps the shortlist at five results, and links each result to its exact item route.

The dataset is fictional sample vehicle data. This is an interaction demo, not live dealer inventory and not evidence from a real website repository.

## Run

From the repository root:

```sh
npm run demo:dynamic
```

Open <http://localhost:3000/discover>.

## Example query

```text
http://localhost:3000/discover?bodyType=SUV&drivetrain=AWD&maxPrice=38000&minYear=2022
```

Supported query parameters are `q`, `make`, `bodyType`, `drivetrain`, `maxPrice`, `minYear`, and `limit`. Unknown filters are named in the response and are not applied. `limit` is capped at five.

Useful routes:

- `/discover` — bounded search form and result shortlist
- `/vehicles` — broad catalogue listing
- `/vehicles/{slug}` — exact item page linked by each result

The site is read-only. It does not submit leads, reserve vehicles, or purchase anything. The price is labelled as advertised CAD price; fees and conditions are not represented. The fixture's timestamps label sample data only and do not guarantee availability.
