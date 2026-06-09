# Customer Feedback Dashboard — Spec

## Users
- **Customers:** submit feedback via /submit page (anonymous OK)
- **Managers:** view all feedback via /admin page

## Screens
1. **/submit** — feedback form
2. **/admin** — table of all feedback with filters

## Data fields
- name (text, optional)
- location (dropdown: District 1, District 3, Thao Dien)
- rating (1-5)
- comment (textarea, required)
- timestamp (auto-generated)

## Storage
- Browser localStorage (no server today)

## Filters on /admin
- Location
- Minimum rating
- Date range (from / to)

## Sentiment indicator
- Rating 1-2: red background
- Rating 3: yellow background
- Rating 4-5: green background

## Export
- "Export CSV" button on /admin downloads filtered rows

## Out of scope (today)
- Authentication
- Real database
- Email notifications
- Multi-language UI