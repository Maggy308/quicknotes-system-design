# QuickNotes Architecture and Scaling Plan

## 1. Functional requirements

- Users can create, read, update, and delete notes.
- Each note belongs to one user and has a required title (maximum 100 characters), body, and timestamps.
- Users can attach reusable tags to notes and filter notes by tag.
- Users can only read or change notes and tags they are authorized to access.
- The client displays loading, success, empty, and error states for API operations.

## 2. Non-functional requirements

- **Availability:** the service should remain usable if an individual app server or worker fails.
- **Performance:** common note reads should feel responsive, with cached data where safe.
- **Scalability:** application servers can scale horizontally as requests increase.
- **Durability:** committed note metadata is stored in a durable database, with backups and point-in-time recovery in production.
- **Security:** use HTTPS, authentication, authorization, input validation, rate limiting, and secure secret management.
- **Consistency:** database writes are transactional; cached views may be briefly stale and should have explicit invalidation or expiry rules.
- **Observability:** record request latency, error rates, queue depth, database health, and saturation metrics without logging private note bodies unnecessarily.

## 3. Load estimates for 1 million users

These are planning estimates, not measured production traffic.

### Assumptions

- Registered users: **1,000,000**.
- **20% daily active users (DAU)** = 200,000 active users per day.
- Each active user reads or refreshes a notes list **30 times/day**.
- Each active user creates **1 note/day**.
- Average stored note content plus metadata is **2 KB** per note.
- Average rates are spread over 86,400 seconds/day; use **5× average** as a rough peak multiplier for API reads and writes.
- One year is 365 days; storage is a logical single copy and excludes backups, indexes, replicas, and growth.

### Reads per second

Daily reads = 200,000 DAU × 30 = **6,000,000 reads/day**.

Average reads/second = 6,000,000 ÷ 86,400 ≈ **69.4 reads/second**.

Estimated 5× peak = 69.4 × 5 ≈ **347 reads/second**.

### Writes per second

Daily note creations = 200,000 DAU × 1 = **200,000 writes/day**.

Average writes/second = 200,000 ÷ 86,400 ≈ **2.3 writes/second**.

Estimated 5× peak = 2.3 × 5 ≈ **11.6 writes/second**. This estimate counts note creations only; edits, deletes, tags, and background jobs add more writes.

### Storage per year

200,000 notes/day × 2 KB = **400,000 KB/day**, approximately **400 MB/day** in decimal units.

400 MB/day × 365 = **146,000 MB/year**, or approximately **146 GB/year** of new note data before indexes, replicas, backups, and operational overhead.

### Read or write heavy?

Under these assumptions, the service is **read-heavy**: it handles about 6 million list reads and 200,000 note creations per day, or 30 reads for every creation. The design should prioritize cacheable list responses and efficient indexed reads while keeping writes transactional and reliable. The real ratio will depend on actual usage, refresh behavior, and how many notes each request returns.

## 4. Architecture diagram

```text
                         ┌─────────────────────┐
                         │   Web / Mobile      │
                         │      Client         │
                         └──────────┬──────────┘
                                    │ DNS lookup
                                    ▼
                         ┌─────────────────────┐
                         │         DNS         │
                         └──────────┬──────────┘
                                    │ HTTPS
                                    ▼
                         ┌─────────────────────┐
                         │         CDN         │
                         │ static assets/cache │
                         └──────────┬──────────┘
                                    │ API request
                                    ▼
                         ┌─────────────────────┐
                         │   Load Balancer     │
                         └──────────┬──────────┘
                                    │
                      ┌─────────────┴──────────────┐
                      ▼                            ▼
             ┌────────────────┐          ┌────────────────┐
             │  App Server A  │          │  App Server B  │
             └───────┬────────┘          └────────┬───────┘
                     └──────────────┬─────────────┘
                                    │
                      ┌─────────────┼──────────────────┐
                      ▼             ▼                  ▼
              ┌────────────┐ ┌──────────────┐  ┌────────────────┐
              │ Cache      │ │ Primary DB   │  │ Job Queue      │
              │ (Redis)    │ │ writes       │  │ async tasks    │
              └────────────┘ └──────┬───────┘  └───────┬────────┘
                                    │                  ▼
                                    ▼             ┌────────────────┐
                             ┌──────────────┐     │ Worker         │
                             │ DB Read      │     │ emails/cleanup │
                             │ Replica      │     └────────────────┘
                             └──────────────┘
```

The CDN serves versioned static client assets and may cache only safe public content; authenticated note responses must not be shared between users by a generic CDN cache. The cache stores short-lived, user-scoped note-list results, and cache keys must include the user ID and relevant filters.

## 5. Component responsibilities

- **Client:** lets users manage notes and communicates with the API over HTTPS.
- **DNS:** maps the service's domain name to the current edge or load-balancer endpoint.
- **CDN:** serves static assets close to users and reduces repeated origin traffic; private note data is not publicly cached.
- **Load balancer:** distributes incoming API requests across healthy application instances and performs health checks.
- **App servers A and B:** validate requests, authenticate and authorize users, apply business rules, and coordinate database/cache/queue operations.
- **Cache:** reduces repeated reads and database load by temporarily storing user-scoped note lists with expiration and invalidation.
- **Primary database:** stores authoritative users, notes, tags, and note-tag relationships with transactions and constraints.
- **Database read replica:** handles suitable read queries to increase read capacity, with the trade-off that replication can lag behind the primary.
- **Job queue:** buffers background work and separates tasks such as notifications or cleanup from the user-facing request.
- **Worker:** processes queued tasks independently and retries transient failures without blocking app servers.

## 6. GET /notes request flow

1. The client resolves the API hostname through DNS and sends `GET /notes` over HTTPS.
2. The CDN serves client assets if needed; authenticated API requests pass through rather than being cached as public content.
3. The load balancer checks health and routes the request to an available app server.
4. The app server validates the access token, determines the user ID, and checks query parameters and permissions.
5. It checks the cache using a key scoped to that user and the requested filters/page.
6. On a cache hit, the server returns the cached response; on a miss, it queries the read replica when suitable (or the primary when fresh read-after-write data is required).
7. The server returns a paginated JSON response and stores a short-lived, user-scoped result in the cache.
8. Metrics record latency and outcome; cache entries are expired or invalidated when relevant notes change.

## 7. POST /notes request flow

1. The client submits `POST /notes` with a JSON title and body over HTTPS.
2. DNS resolves the API domain, and the load balancer routes the request to a healthy app server.
3. The app server authenticates the user and validates that the title is present and no longer than 100 characters.
4. The server starts a database transaction and inserts the note with the authenticated user's ID; constraints enforce valid data.
5. The primary database commits the new note and returns its generated ID and timestamps.
6. The app server invalidates or updates the user's cached note lists so future reads can see the new note.
7. If a background task is required, the server publishes it to the queue (preferably using a transactional outbox so a committed write is not lost if queue publishing fails).
8. The server returns `201 Created` with the new note JSON; a worker handles queued work asynchronously and retries transient errors.

## 8. Trade-offs and reliability

### Cache speed versus freshness

Caching makes repeated list reads faster and lowers database load, but cached lists can briefly be stale after a create, update, or delete. Use short TTLs, user-scoped cache keys, and explicit invalidation after successful writes.

### Read replicas versus read-after-write consistency

A read replica spreads read load, but asynchronous replication can delay a new note appearing in a subsequent list. Route critical read-after-write requests to the primary or briefly bypass the replica for the writing user.

### Async queue versus immediate completion

A queue keeps email, notifications, and cleanup work out of the request path and absorbs spikes, but queued tasks are not instantaneous and can fail. Use durable queues, retries with backoff, dead-letter handling, idempotent workers, and queue-depth alerts.

### Horizontal scale versus operational complexity

Multiple stateless app servers improve throughput and allow instances to be replaced, but introduce deployment, monitoring, and configuration complexity. Run at least two instances across separate failure domains, use health checks and rolling deployments, and avoid storing session state only in process memory.

### Avoiding single points of failure

- Run multiple app servers across separate availability zones behind a health-checking load balancer.
- Use a highly available managed database configuration with automated failover, backups, and tested recovery; a read replica alone is not a substitute for a primary failover plan.
- Deploy redundant cache nodes or a managed cache with failover, and treat cache loss as a performance issue rather than a data-loss event.
- Use a durable, replicated queue and multiple workers so a single worker failure does not stop processing.
- Use a redundant DNS/CDN provider configuration where justified, monitor health, and test disaster-recovery procedures regularly.

## 9. Scope note

The browser client in this repository uses JSONPlaceholder for learning purposes. Its POST and DELETE endpoints simulate writes and do not persist changes on the remote service. The API and data-model documents describe the intended production QuickNotes service rather than claiming that the demo API implements authentication, tags, or database persistence.
