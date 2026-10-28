# QuickNotes System Design

QuickNotes is a small notes API client and system-design project. The browser client demonstrates loading notes, creating a note, and deleting notes through HTTP requests. The accompanying documents describe a REST API, relational data model, and architecture for scaling a production notes service.

> **Demo limitation:** The client uses JSONPlaceholder at `https://jsonplaceholder.typicode.com/posts`. It is a public mock API: POST and DELETE responses are simulated and do not permanently change the remote data. The design documents describe a proposed production API.

## Project files

- `index.html` — accessible HTML5 page and note form.
- `style.css` — responsive styling and distinct status states.
- `api.js` — reusable fetch helper plus GET, POST, DELETE, validation, rendering, and error handling.
- [API design](docs/api-design.md) — REST endpoints, JSON examples, and error responses.
- [Data model](docs/data-model.md) — users, notes, tags, join table, SQL schema, queries, and indexes.
- [Architecture](docs/architecture.md) — scaling estimates, architecture diagram, request flows, trade-offs, and resilience.

## How to run the API client

1. Clone or download this repository.
2. Open the repository folder on your computer.
3. Open `index.html` in a modern browser. No build step or package installation is required.
4. Select **Load 10 notes** to request the first ten sample posts.
5. Enter a title (required, maximum 100 characters) and an optional body, then select **Create note**.
6. Select **Delete** on a note to send a DELETE request.
7. You can also serve the folder with a local static server, for example `python -m http.server 8000`, then open `http://localhost:8000`.

The browser needs an internet connection to reach JSONPlaceholder. If the request fails, the page displays an error status. New notes created in the demo are added to the current page locally after the mock POST response; they are not persisted by JSONPlaceholder after a reload.

## What I learned

- How to use a reusable `async` request helper with `fetch`, check `response.ok`, and handle errors with `try/catch/finally`.
- Why accessible labels, input validation, disabled buttons during requests, and clear loading/success/error/empty states improve an API client.
- How REST endpoints use HTTP methods and status codes to express operations on resources.
- How primary keys, foreign keys, unique constraints, indexes, and a join table model data consistently in SQL.
- How caching, read replicas, load balancing, queues, and background workers address different scaling bottlenecks—and what consistency and operational trade-offs they introduce.

## Run and review

This is a front-end learning demo, not a deployed production backend. The API design and database schema are design artifacts and would need a real server, authentication, authorization, and database implementation to provide the full production behavior described in the documents.
