# Architecture

The React client calls a small FastAPI control plane. The control plane owns migration lifecycle, file storage, event fan-out, and the repository boundary. Compose connects to the configured MongoDB Atlas cluster; MongoDB is an external managed dependency and is not run inside the application containers. The migration graph is a sequence of narrow nodes with a conditional decision gate:

```text
profile → map → reconcile → validate → decision
                                      ├─ review pause
                                      └─ execute → verify → complete
```

The graph state contains references and metadata. PrivateContext is the only place tools can retrieve raw records. The mapper can inspect schema and samples but is not allowed to mutate the target. Only the executor receives mutation tools. Events are stored in `agent_events` and streamed to the UI through SSE.

The TargetAdapter interface keeps the graph provider-neutral. The mock target is an HTTP FastAPI service for the demo. The Darwinbox adapter uses MCP when configured and REST as a fallback.
