# Governed autonomy design

The migration agent is optimized for maximum safe autonomy, not maximum automation.

## The agent handles autonomously

- file type detection, header inspection, profiling, and likely entity-key discovery
- obvious field mappings with compatible types and several evidence signals
- whitespace, casing, email, phone, and unambiguous date normalization
- duplicate resolution where employee ID or a strong normalized email agrees
- deterministic schema validation and safe, idempotent retries
- target verification and audit emission

## The agent escalates

- ambiguous source fields such as `status` with multiple plausible target meanings
- conflicting values from two source systems
- uncertain date interpretation such as `01/02/2024` without locale evidence
- unresolved duplicate/entity matches
- validation failures after safe repair attempts
- a high-risk mutation that needs consultant approval

Each review item records the source value, target field, candidates, confidence, evidence, impact, file, and row. The consultant can approve, correct, reject, skip, or apply a decision to similar cases. The graph resumes at execution after the last blocking review is resolved.

## The agent blocks

- unauthorized tool access
- invalid target schema or missing required identity
- unsafe/destructive target operations
- failed authorization, malformed external responses, or a target operation outside policy

## Autonomy levels

`AUTO` means safe and high-confidence. `REVIEW` means recoverable ambiguity. `BLOCK` means the system must not proceed. Thresholds live in the control plane and are visible in mapping and escalation records.

