export const jobNames = [] as const;

export type JobName = (typeof jobNames)[number];
