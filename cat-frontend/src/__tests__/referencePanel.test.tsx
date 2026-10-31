import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReferencePanel from '../features/reference/ReferencePanel';
import { parseStatus, retryRequest } from '../features/reference/api';
import type { ReferenceJob, ReferenceStatus } from '../features/reference/api';

const job: ReferenceJob = {
  job_id: 'a'.repeat(32),
  kind: 'rebuild',
  status: 'queued',
  crop: true,
  publish: true,
  target_snapshot_id: null,
  snapshot_id: null,
  publication_id: null,
  completed_photos: 0,
  total_photos: 0,
  requested_generation: 2,
  created_at: '2026-10-31T03:00:00+00:00',
  updated_at: '2026-10-31T03:00:00+00:00',
  code: null,
  detail: null,
};
const initial: ReferenceStatus = {
  status: 'unavailable',
  code: 'pointer_unavailable',
  store_configured: true,
  pending_changes: true,
  current_catalog: {
    database_id: 'b'.repeat(32),
    generation: 2,
    cat_count: 2,
    photo_count: 1,
    cats_without_photos: 1,
  },
  published: null,
  catalog_error: null,
  publication_error: null,
  job_error: null,
  jobs: [],
  checked_at: '2026-10-31T03:00:00+00:00',
};
let state: ReferenceStatus;
let statusCode: number;
let client: QueryClient;
function show(canManage = true) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReferencePanel canManage={canManage} />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('admin_token', 'admin-only');
  localStorage.setItem('token', 'ordinary-user');
  state = structuredClone(initial);
  statusCode = 200;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit) => {
      expect(options.headers).toMatchObject({ Authorization: 'Bearer admin-only' });
      if (url === '/api/admin/reference/status')
        return new Response(JSON.stringify(state), { status: statusCode });
      if (url === '/api/admin/reference/jobs') {
        state.jobs = [job];
        return new Response(JSON.stringify(job), { status: 202 });
      }
      throw new Error(`Unexpected request ${url}`);
    })
  );
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.unstubAllGlobals();
});

it('submits one job and waits for publication instead of claiming success', async () => {
  show();
  const submit = await screen.findByRole('button', { name: '重建并发布' });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(await screen.findByText('等待执行')).toBeInTheDocument();
  expect(screen.getByText('参考版本暂不可用')).toBeInTheDocument();
  expect(screen.queryByText('参考版本可用', { exact: true })).not.toBeInTheDocument();
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/admin/reference/jobs')
  ).toHaveLength(1);
  expect(submit).toBeDisabled();
});

it('renders progress and refreshes to verified current state', async () => {
  state.jobs = [{ ...job, status: 'running', completed_photos: 1, total_photos: 2 }];
  show();
  expect(await screen.findByRole('progressbar')).toHaveAttribute('value', '1');
  expect(screen.getByText('已处理 1 / 2 张；完成后还需校验与发布。')).toBeInTheDocument();
  state = {
    ...state,
    status: 'compatible',
    pending_changes: false,
    code: 'validated',
    published: {
      snapshot_id: 'c'.repeat(32),
      publication_id: 'd'.repeat(32),
      catalog_generation: 2,
      photo_count: 1,
      created_at: job.created_at,
    },
    jobs: [{ ...job, status: 'succeeded', snapshot_id: 'c'.repeat(32), code: 'published' }],
  };
  fireEvent.click(screen.getByRole('button', { name: '刷新状态' }));
  expect(await screen.findByText('参考版本可用', { exact: true })).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(
    screen.getByText('尚无参考照片的猫不会出现在识别候选中，请在猫档案中补充照片。')
  ).toBeInTheDocument();
});

it('retries failed work with the same operation options and displays structured conflict errors', async () => {
  state.jobs = [
    {
      ...job,
      kind: 'rollback',
      status: 'failed',
      target_snapshot_id: 'e'.repeat(32),
      code: 'generation_mismatch',
    },
  ];
  const normal = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (...args) =>
    args[0] === '/api/admin/reference/jobs'
      ? new Response(JSON.stringify({ detail: { code: 'writer_busy', message: 'busy' } }), {
          status: 409,
        })
      : normal(...args)
  );
  show();
  const retry = await screen.findByRole('button', { name: '重试回滚任务' });
  await waitFor(() => expect(retry).toBeEnabled());
  fireEvent.click(retry);
  expect(await screen.findByRole('alert')).toHaveTextContent('已有任务等待或正在执行');
  const post = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/admin/reference/jobs')!;
  expect(JSON.parse(post[1]?.body as string)).toEqual({
    kind: 'rollback',
    crop: true,
    publish: true,
    snapshot_id: 'e'.repeat(32),
  });
  expect(screen.queryByText(/已受理/)).not.toBeInTheDocument();
});

it('treats a lost submit response as uncertain and reconciles the accepted job', async () => {
  const normal = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (args[0] === '/api/admin/reference/jobs') {
      state.jobs = [job];
      throw new TypeError('network');
    }
    return normal(...args);
  });
  show();
  const submit = await screen.findByRole('button', { name: '重建并发布' });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
  expect(await screen.findByRole('alert')).toHaveTextContent('未能确认提交结果');
  expect(await screen.findByText('等待执行')).toBeInTheDocument();
  expect(submit).toBeDisabled();
});

it('marks cached data as stale after refresh failure and permits recovery without clearing credentials', async () => {
  state.status = 'compatible';
  state.pending_changes = false;
  show();
  expect(await screen.findByText('参考版本可用', { exact: true })).toBeInTheDocument();
  statusCode = 503;
  fireEvent.click(screen.getByRole('button', { name: '刷新状态' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('当前状态待确认');
  expect(screen.queryByText('参考版本可用', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重建并发布' })).toBeDisabled();
  expect(localStorage.getItem('admin_token')).toBe('admin-only');
  statusCode = 200;
  fireEvent.click(screen.getByRole('button', { name: '刷新状态' }));
  expect(await screen.findByText('参考版本可用', { exact: true })).toBeInTheDocument();
});

it('gives reviewers read-only status including failed jobs', async () => {
  state.jobs = [{ ...job, status: 'failed', code: 'invalid_vector' }];
  show(false);
  expect(await screen.findByText('审核员可查看状态；提交任务请联系管理员。')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重建并发布' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /重试.*任务/ })).not.toBeInTheDocument();
});

it.each(['unconfigured', 'no_photos', 'corrupt_journal'])(
  'blocks inappropriate rebuild in %s state',
  async (mode) => {
    if (mode === 'unconfigured') state.store_configured = false;
    if (mode === 'no_photos') state.current_catalog!.photo_count = 0;
    if (mode === 'corrupt_journal')
      state.job_error = { code: 'job_unreadable', message: 'corrupt' };
    show();
    expect(await screen.findByRole('button', { name: '重建并发布' })).toBeDisabled();
  }
);

it.each([
  { jobs: [{ ...job, total_photos: -1 }] },
  { pending_changes: 'false' },
  { current_catalog: { ...initial.current_catalog, photo_count: '1' } },
  { checked_at: 'invalid-date' },
])('rejects malformed status fields before enabling actions: %o', (change) => {
  expect(() => parseStatus({ ...initial, ...change })).toThrow('参考库返回格式异常');
});

it('preserves candidate-only and no-crop options when retrying a rebuild', () => {
  expect(retryRequest({ ...job, crop: false, publish: false })).toEqual({
    kind: 'rebuild',
    crop: false,
    publish: false,
  });
});
