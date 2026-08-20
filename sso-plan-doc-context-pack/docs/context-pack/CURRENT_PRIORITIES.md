# Current Priorities

Recommended order after this documentation bootstrap:

1. **Security cleanup**
   - rotate exposed Facebook Page token
   - sanitize `.env.example`
   - inspect repository for other committed secrets

2. **Verify current multi-platform path end-to-end**
   - build/typecheck
   - tests
   - PostgreSQL + Redis
   - create one scheduled video per platform
   - verify delayed execution and persisted statuses

3. **Unify or clearly separate Facebook implementations**
   - direct CLI versus scheduled publisher
   - prevent behavior drift
   - decide whether `video` / `both` remain supported given Facebook's Reel unification behavior

4. **Improve automated tests for scheduler/publish**
   - platform fan-out
   - delay calculation
   - retries
   - worker state transitions
   - bulk import

5. **Refresh user-facing README**
   - only after current runtime is verified
   - describe the system as Social Video Scheduler, not TikTok-only MVP

6. **Repository cleanup**
   - decide whether large/test/generated artifacts belong in Git
