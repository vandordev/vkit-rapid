# Worker Rules

- Workers consume named queue jobs and invoke application usecases.
- Retry policy, idempotency, structured job logging, and graceful shutdown belong to the worker boundary.
- A handler must not contain product business rules or access HTTP transport concerns.
- Keep the generic baseline free of product jobs; add a job contract and focused handler test with each feature.
