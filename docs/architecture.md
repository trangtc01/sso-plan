# Architecture mapping

| Business specification | Implementation |
|---|---|
| Video management | `Video`, upload API, Next.js CMS |
| Voice / render | `RenderJob`, `TtsProvider`, `Renderer`, `voice`/`render` queue contracts |
| Multi-platform publish | `PublishJob`, `PlatformAccount`, `PublisherRegistry`, per-platform queue contracts |
| Scheduler | indexed `publishTime`; scheduler dispatches only due `SCHEDULED` jobs |
| Retry/logs | BullMQ exponential retry; attempts, journal, artifacts and error fields |
| Monitoring | `/health`, persisted statuses and admin polling |

External adapters must never report `PUBLISHED` until they have an external provider response. TikTok draft remains separate from public publishing.
