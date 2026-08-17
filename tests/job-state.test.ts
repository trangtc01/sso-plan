import assert from "node:assert/strict";
import test from "node:test";
import { VideoStatus } from "@prisma/client";
import { assertTransition, isTerminal } from "../apps/api/src/job-state.js";

test("state machine accepts the draft happy path", () => { assert.doesNotThrow(() => assertTransition(VideoStatus.UPLOADING, VideoStatus.SAVING_DRAFT)); assert.doesNotThrow(() => assertTransition(VideoStatus.VERIFYING, VideoStatus.DRAFT_SAVED)); });
test("state machine rejects publish-like shortcut and marks ambiguous terminal", () => { assert.throws(() => assertTransition(VideoStatus.QUEUED, VideoStatus.DRAFT_SAVED)); assert.equal(isTerminal(VideoStatus.AMBIGUOUS), true); });
