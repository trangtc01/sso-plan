import { QUEUES } from "../../api/src/platform-contracts.js";
import { Queue } from "bullmq";

export function createPipelineQueues(redisUrl: string) {
  const connection = { url: redisUrl };
  return Object.fromEntries(Object.values(QUEUES).map(name => [name, new Queue(name, { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: 500, removeOnFail: 500 } })]));
}
