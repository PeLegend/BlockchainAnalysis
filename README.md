```mermaid
graph TD;
    A[User] -->|Search| B[Document];
    A -->|Like| C[Comment];
    B --> D[Tag];
    C --> D;
    D --> E[Score];
    E --> F[Recommendation];
```