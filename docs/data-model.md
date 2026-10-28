# QuickNotes Data Model

## Entities and columns

### `users`

- `id INTEGER PRIMARY KEY` — unique user identifier.
- `name TEXT NOT NULL` — display name.
- `email TEXT NOT NULL UNIQUE` — login/contact email; duplicates are not allowed.
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` — account creation time in SQLite's timestamp format.

### `notes`

- `id INTEGER PRIMARY KEY` — unique note identifier.
- `user_id INTEGER NOT NULL` — foreign key to `users.id`.
- `title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 100)` — required title, maximum 100 characters.
- `body TEXT NOT NULL DEFAULT ''` — note contents.
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` — creation time.
- `updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` — last update time.

### `tags`

- `id INTEGER PRIMARY KEY` — unique tag identifier.
- `user_id INTEGER NOT NULL` — foreign key to the user who owns the tag.
- `name TEXT NOT NULL` — tag label.
- `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` — creation time.
- `UNIQUE(user_id, name)` — a user cannot create the same tag name twice.

### `note_tags`

- `note_id INTEGER NOT NULL` — foreign key to `notes.id`.
- `tag_id INTEGER NOT NULL` — foreign key to `tags.id`.
- `added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` — time the tag was attached.
- `PRIMARY KEY(note_id, tag_id)` — prevents the same tag being attached to a note more than once.

## SQLite CREATE TABLE statements

Run this schema in order; foreign-key enforcement is enabled for the current SQLite connection.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);
CREATE INDEX idx_tags_user ON tags(user_id);
```

## Relationships

- **Users to notes is one-to-many:** one user can own many notes, but each note has one owner through `notes.user_id`.
- **Users to tags is one-to-many:** one user can create many tags, and each tag belongs to one user.
- **Notes to tags is many-to-many:** a note can have several tags and a tag can be applied to several notes. The `note_tags` join table stores each association and its composite primary key prevents duplicate associations.

Foreign keys maintain referential integrity. The `ON DELETE CASCADE` rules remove a user's notes/tags and a note's tag links when the parent is deleted. In a production multi-user application, authorization rules must also ensure users cannot attach another user's tag to their notes.

## Example SQL queries

### 1. List one user's notes, newest first

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC, id DESC;
```

### 2. JOIN notes to their owner

```sql
SELECT n.title, n.body, u.name AS owner_name, u.email
FROM notes AS n
JOIN users AS u ON u.id = n.user_id
WHERE n.id = 10;
```

### 3. Find notes with a given tag

```sql
SELECT n.id, n.title, t.name AS tag_name
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.id
JOIN tags AS t ON t.id = nt.tag_id
WHERE t.user_id = 1 AND t.name = 'work'
ORDER BY n.created_at DESC;
```

### 4. Count notes per user, including users with no notes

```sql
SELECT u.id, u.name, COUNT(n.id) AS note_count
FROM users AS u
LEFT JOIN notes AS n ON n.user_id = u.id
GROUP BY u.id, u.name
ORDER BY u.name;
```

## Index choice

The index `idx_notes_user_created(user_id, created_at DESC)` supports the common query that lists one user's notes newest-first. It can reduce scanning and sorting as the notes table grows; indexes speed up reads but use disk space and add some work to writes.

## SQL or NoSQL?

I would choose a relational SQL database such as PostgreSQL for the production service, and SQLite for a small local demo. Users, notes, tags, and their associations have clear relationships that benefit from foreign keys, uniqueness constraints, transactions, and JOINs. A document database could be useful for some flexible metadata, but embedding tags into every note can duplicate tag data and make consistent updates harder. SQL is the better default because correctness and clear ownership relationships matter for personal notes.
