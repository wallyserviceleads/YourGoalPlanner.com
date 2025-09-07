# Goal Tracking Calendar (Unbranded, Local-First) — v2

- Multiple entries per day (label + amount)
- Settings gear + modal
- Goal name, amount, and **date range**
- Weekday toggles (Sun..Sat) for workdays
- **Light/Dark** theme toggle
- Export/Import/Reset moved into Settings
- Targets from goal range:
  - Daily = goal ÷ working days in range
  - Weekly = daily × selected weekdays/week
  - Monthly = daily × working days in current month
  - Quarterly = daily × working days in current quarter
- **Range Progress** sums entries within the date range

## Local development

Run the included Express server to serve the site locally:

```bash
node server.js
```

Then open <http://localhost:3000> in your browser.

## Auth0 configuration

Ensure your Auth0 application includes the app's origin in its **Allowed Logout URLs**. For local development this is typically `http://localhost:3000`. This value must match the `returnTo` parameter used when logging out (`window.location.origin`).
