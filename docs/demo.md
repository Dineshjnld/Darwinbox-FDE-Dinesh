# Five-minute demo

1. Open the UI and choose **Create demo migration**.
2. Choose **Load sample files**, then **Start migration**.
3. Watch the event stream and open **Escalations**. The `status` mapping and department conflict are intentionally reviewable.
4. Approve the recommended mapping. The workflow resumes without re-ingesting files.
5. Open **Execution**. The deterministic `EMP005` mock failure is visible; use **Retry**.
6. Confirm the success rate and inspect the chronological Audit Log.

The sample data is safe to run repeatedly because the target adapter generates an idempotency key from migration, source record, and operation identity.

