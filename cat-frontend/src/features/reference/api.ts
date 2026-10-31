import { requestAdminData } from '../../api';

export type JobKind = 'rebuild' | 'publish' | 'rollback';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted';
export interface ReferenceJob {
  job_id: string;
  kind: JobKind;
  status: JobStatus;
  crop: boolean;
  publish: boolean;
  target_snapshot_id: string | null;
  snapshot_id: string | null;
  publication_id: string | null;
  completed_photos: number;
  total_photos: number;
  requested_generation: number;
  created_at: string;
  updated_at: string;
  code: string | null;
  detail: string | null;
}
interface Diagnostic {
  code: string;
  message: string;
}
export interface ReferenceStatus {
  status: 'compatible' | 'unavailable';
  code: string;
  store_configured: boolean;
  pending_changes: boolean | null;
  current_catalog: {
    database_id: string;
    generation: number;
    cat_count: number;
    photo_count: number;
    cats_without_photos: number;
  } | null;
  published: {
    snapshot_id: string;
    publication_id: string | null;
    catalog_generation: number;
    photo_count: number;
    created_at: string;
  } | null;
  catalog_error: Diagnostic | null;
  publication_error: Diagnostic | null;
  job_error: Diagnostic | null;
  jobs: ReferenceJob[];
  checked_at: string;
}
export interface JobRequest {
  kind: JobKind;
  crop: boolean;
  publish: boolean;
  snapshot_id?: string;
}

const invalid = () => new Error('参考库返回格式异常，请刷新；若仍失败请联系维护人员。');
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw invalid();
  return value;
}
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw invalid();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}
function id(value: unknown): string {
  const result = text(value);
  if (!/^[0-9a-f]{32}$/.test(result)) throw invalid();
  return result;
}
function timestamp(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw invalid();
  return result;
}
function nullable<T>(value: unknown, parse: (v: unknown) => T): T | null {
  return value === null ? null : parse(value);
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  for (const item of choices) if (value === item) return item;
  throw invalid();
}
function diagnostic(value: unknown): Diagnostic {
  const data = record(value);
  return { code: text(data.code), message: text(data.message) };
}
export function parseJob(value: unknown): ReferenceJob {
  const data = record(value);
  const job = {
    job_id: id(data.job_id),
    kind: choice(data.kind, ['rebuild', 'publish', 'rollback'] as const),
    status: choice(data.status, [
      'queued',
      'running',
      'succeeded',
      'failed',
      'interrupted',
    ] as const),
    crop: flag(data.crop),
    publish: flag(data.publish),
    target_snapshot_id: nullable(data.target_snapshot_id, id),
    snapshot_id: nullable(data.snapshot_id, id),
    publication_id: nullable(data.publication_id, id),
    completed_photos: count(data.completed_photos),
    total_photos: count(data.total_photos),
    requested_generation: count(data.requested_generation),
    created_at: timestamp(data.created_at),
    updated_at: timestamp(data.updated_at),
    code: nullable(data.code, text),
    detail: nullable(data.detail, text),
  };
  if (
    job.completed_photos > job.total_photos ||
    (job.kind !== 'rebuild' && !job.target_snapshot_id)
  )
    throw invalid();
  return job;
}
export function parseStatus(value: unknown): ReferenceStatus {
  const data = record(value);
  if (!Array.isArray(data.jobs)) throw invalid();
  return {
    status: choice(data.status, ['compatible', 'unavailable'] as const),
    code: text(data.code),
    store_configured: flag(data.store_configured),
    pending_changes: nullable(data.pending_changes, flag),
    current_catalog: nullable(data.current_catalog, (value) => {
      const item = record(value);
      return {
        database_id: id(item.database_id),
        generation: count(item.generation),
        cat_count: count(item.cat_count),
        photo_count: count(item.photo_count),
        cats_without_photos: count(item.cats_without_photos),
      };
    }),
    published: nullable(data.published, (value) => {
      const item = record(value);
      return {
        snapshot_id: id(item.snapshot_id),
        publication_id: nullable(item.publication_id, id),
        catalog_generation: count(item.catalog_generation),
        photo_count: count(item.photo_count),
        created_at: timestamp(item.created_at),
      };
    }),
    catalog_error: nullable(data.catalog_error, diagnostic),
    publication_error: nullable(data.publication_error, diagnostic),
    job_error: nullable(data.job_error, diagnostic),
    jobs: data.jobs.map(parseJob),
    checked_at: timestamp(data.checked_at),
  };
}
export async function getReferenceStatus(signal?: AbortSignal): Promise<ReferenceStatus> {
  return parseStatus(await requestAdminData('/admin/reference/status', { signal }));
}
export async function submitReferenceJob(payload: JobRequest): Promise<ReferenceJob> {
  return parseJob(
    await requestAdminData('/admin/reference/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );
}
export function retryRequest(job: ReferenceJob): JobRequest {
  return {
    kind: job.kind,
    crop: job.crop,
    publish: job.publish,
    ...(job.target_snapshot_id ? { snapshot_id: job.target_snapshot_id } : {}),
  };
}
