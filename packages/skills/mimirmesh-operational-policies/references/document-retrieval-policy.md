# Document Retrieval Policy

Retrieve before you generate.

- Search existing specifications, ADRs, feature docs, architecture docs, and runbooks before drafting new material.
- Use `search_docs` for targeted document retrieval.
- Use `document_architecture` when the question is about subsystem design, architecture context, or existing decisions.
- Use `document_runbook` only when the operator procedure actually needs to change or be created.
- Use `generate_adr` only after retrieving current architecture context and confirming the change crosses an ADR threshold.
- Generated docs must be grounded in code, accepted decisions, and real runtime behavior.
- Do not create new docs that duplicate an existing canonical document.
