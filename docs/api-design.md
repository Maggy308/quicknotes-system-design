# QuickNotes REST API Design

**Base URL:** `https://api.quicknotes.example/v1`  
**Content type:** `application/json`  
**Authentication:** Protected routes require a bearer access token in the `Authorization` header.

## Endpoints

- **List notes**
  - **Method and path:** `GET /notes?limit=20&cursor=abc`
  - **Description:** Returns the authenticated user's notes, newest first, with optional pagination.
  - **Success:** `200 OK`

- **Get one note**
  - **Method and path:** `GET /notes/{noteId}`
  - **Description:** Returns one note the authenticated user is allowed to access.
  - **Success:** `200 OK`

- **Create a note**
  - **Method and path:** `POST /notes`
  - **Description:** Creates a note owned by the authenticated user; title is required and limited to 100 characters.
  - **Example request body:**
    ```json
    {
      "title": "Meeting notes",
      "body": "Follow up on the project plan.",
      "tagIds": [2, 4]
    }
    ```
  - **Example response body:**
    ```json
    {
      "id": 731,
      "userId": 42,
      "title": "Meeting notes",
      "body": "Follow up on the project plan.",
      "createdAt": "2026-10-28T09:30:00Z",
      "updatedAt": "2026-10-28T09:30:00Z",
      "tags": [
        { "id": 2, "name": "work" },
        { "id": 4, "name": "planning" }
      ]
    }
    ```
  - **Success:** `201 Created`

- **Update a note**
  - **Method and path:** `PUT /notes/{noteId}`
  - **Description:** Replaces the editable title and body of a note owned by the authenticated user.
  - **Example request body:**
    ```json
    { "title": "Updated meeting notes", "body": "Send the revised plan by Friday." }
    ```
  - **Success:** `200 OK`

- **Partially update a note**
  - **Method and path:** `PATCH /notes/{noteId}`
  - **Description:** Changes only supplied fields, such as a title or body.
  - **Example request body:**
    ```json
    { "title": "Final meeting notes" }
    ```
  - **Success:** `200 OK`

- **Delete a note**
  - **Method and path:** `DELETE /notes/{noteId}`
  - **Description:** Deletes a note owned by the authenticated user.
  - **Success:** `204 No Content`

- **List notes by tag**
  - **Method and path:** `GET /notes?tagId=4`
  - **Description:** Returns the authenticated user's notes associated with the specified tag.
  - **Success:** `200 OK`

- **List tags**
  - **Method and path:** `GET /tags`
  - **Description:** Lists tags available to the authenticated user.
  - **Success:** `200 OK`

## Error status codes

- **`400 Bad Request`** — The body is invalid, a required title is missing, or the title exceeds 100 characters.
- **`401 Unauthorized`** — The access token is missing, expired, or invalid.
- **`403 Forbidden`** — The user is authenticated but does not have permission to perform an operation on the requested resource.
- **`404 Not Found`** — The note or tag ID does not exist or is not available to the user.
- **`500 Internal Server Error`** — An unexpected server failure occurred.

Example error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer."
  }
}
```

## API conventions

- Use plural resource names and standard HTTP methods.
- Return JSON for successful reads and errors, except `204 No Content` for a successful delete.
- Validate input on the server even when the browser also validates it.
- Apply authorization checks to every note read, update, and delete so users can only access their own notes.
- Use pagination for large collections and stable ordering such as `createdAt DESC, id DESC`.
