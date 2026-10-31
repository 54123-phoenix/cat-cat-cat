import { useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api';
import { getReferenceStatus, retryRequest, submitReferenceJob } from './api';
import type { JobRequest, ReferenceJob } from './api';

const actionClass =
  'min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 disabled:cursor-not-allowed';
const kinds = { rebuild: '重建', publish: '发布', rollback: '回滚' };
const states = {
  queued: '等待执行',
  running: '正在处理',
  succeeded: '已完成',
  failed: '失败',
  interrupted: '已中断',
};
const reasons: Record<string, string> = {
  writer_busy: '已有任务等待或正在执行，请等待结束后再提交。',
  store_not_configured: '尚未配置参考库任务服务，请联系维护人员。',
  model_unavailable: '识别模型未准备好，请联系维护人员检查模型文件。',
  detector_unavailable: '图片检测模型未准备好，请联系维护人员检查。',
  invalid_source: '参考照片缺失或无法读取，请修复照片后重建。',
  invalid_vector: '有照片未生成有效的识别特征，请检查照片及模型后重试。',
  source_build_failed: '处理参考照片失败，请检查下方诊断信息。',
  generation_mismatch: '猫档案或参考照片已变化，请按当前资料重新构建。',
  catalog_changed: '参考照片已变化，请按当前资料重新构建。',
  inputs_changed: '构建或检查期间资料发生变化，请刷新状态后重试。',
  model_mismatch: '模型版本已变化，需要重新构建参考库。',
  pipeline_mismatch: '图片处理方式不匹配，需要按当前配置重建。',
  pointer_unavailable: '尚无可读取的当前参考版本，请重建；已有版本时请查看诊断。',
  artifact_mismatch: '参考版本文件校验失败，请重建或联系维护人员恢复。',
  writer_interrupted: '构建进程已中断，请确认任务服务恢复后重试。',
  job_unreadable: '任务记录损坏，提交已暂停，请联系维护人员处理。',
  publication_changed: '发布版本正在切换，请刷新状态。',
};
function explanation(code: string | null, fallback: string) {
  return (code && reasons[code]) || fallback;
}
function time(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
function jobLabel(job: ReferenceJob) {
  if (job.status !== 'succeeded') return states[job.status];
  return job.code === 'candidate_ready' ? '候选已生成，未发布' : '该次发布已完成';
}

export default function ReferencePanel({ canManage }: { canManage: boolean }) {
  const instance = useId();
  const client = useQueryClient();
  const queryKey = ['admin-reference', instance];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getReferenceStatus(signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [acceptedId, setAcceptedId] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const data = query.data;
  const accepted = data?.jobs.find((job) => job.job_id === acceptedId);
  const showAccepted =
    acceptedId && (!accepted || accepted.status === 'queued' || accepted.status === 'running');
  const busy =
    data?.jobs.some((job) => job.status === 'queued' || job.status === 'running') ?? false;
  const disabled =
    !canManage ||
    forbidden ||
    pending ||
    busy ||
    query.isError ||
    query.isFetching ||
    !data?.store_configured ||
    !!data.job_error ||
    !data.current_catalog ||
    !!data.catalog_error;

  async function submit(payload: JobRequest) {
    if (submitting.current || disabled) return;
    submitting.current = true;
    setPending(true);
    setSubmitError('');
    setAcceptedId('');
    try {
      await client.cancelQueries({ queryKey });
      const job = await submitReferenceJob(payload);
      setAcceptedId(job.job_id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true);
        setSubmitError('当前账号没有提交权限，请重新验证管理身份。');
      } else {
        setSubmitError(
          error instanceof ApiError
            ? explanation(error.code ?? null, error.message)
            : '未能确认提交结果，请先刷新任务记录，避免重复提交。'
        );
      }
    } finally {
      // Reconcile with server state even when the POST response was lost.
      await query.refetch();
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="reference-title" className="space-y-4 text-text">
      <div className="flex items-center justify-between gap-3">
        <h2 id="reference-title" className="text-lg font-bold">
          识别参考库
        </h2>
        <button
          className={actionClass}
          disabled={query.isFetching || pending}
          onClick={() => void query.refetch()}
        >
          刷新状态
        </button>
      </div>
      <p className="text-sm text-text-secondary">
        猫档案保存后，需要完成参考库发布，识别才会使用新资料。
      </p>
      {query.isPending && (
        <div role="status" className="rounded-xl bg-card p-4 text-sm">
          正在读取参考库与任务记录…
        </div>
      )}
      {query.isError && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
          状态读取失败。
          {data ? '下方为上次读取的数据，当前状态待确认，提交已暂停。' : '请刷新重试。'}
        </p>
      )}
      {showAccepted && (
        <p role="status" className="text-sm">
          任务 {acceptedId.slice(0, 8)} 已受理，请等待执行结果。
        </p>
      )}
      {submitError && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
          {submitError}
        </p>
      )}
      {data && (
        <>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="space-y-1" aria-live="polite">
              <h3 className="font-bold">
                {query.isError
                  ? '当前状态待确认'
                  : data.status === 'compatible'
                    ? '参考版本可用'
                    : '参考版本暂不可用'}
              </h3>
              <p className="text-sm text-text-secondary">
                {data.pending_changes === true
                  ? '有资料尚未发布到当前参考库。'
                  : data.pending_changes === false
                    ? '档案与参考照片没有待发布变化。'
                    : '暂时无法核对待发布变化。'}
              </p>
              {!query.isError && data.status === 'unavailable' && (
                <p className="text-sm">
                  {explanation(data.code, '当前版本未通过校验，请查看诊断信息或联系维护人员。')}
                </p>
              )}
              <p className="text-xs text-text-secondary">
                参考版本可用仅表示资料校验通过，识别效果仍需单独评测。
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              <div>
                <dt className="text-text-secondary">档案 / 参考照片</dt>
                <dd className="font-semibold">
                  {data.current_catalog
                    ? `${data.current_catalog.cat_count} 只 / ${data.current_catalog.photo_count} 张`
                    : '待确认'}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">尚无参考照片</dt>
                <dd className="font-semibold">
                  {data.current_catalog
                    ? `${data.current_catalog.cats_without_photos} 只`
                    : '待确认'}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-text-secondary">
                  {data.store_configured ? '最近发布版本' : '独立参考版本'}
                </dt>
                <dd className="break-all font-mono text-xs mt-1">
                  {data.published?.snapshot_id ?? '暂无可核对版本'}
                </dd>
              </div>
              {data.published && (
                <div className="col-span-2">
                  <dt className="text-text-secondary">版本构建时间 / 照片数</dt>
                  <dd>
                    {time(data.published.created_at)} · {data.published.photo_count} 张
                  </dd>
                </div>
              )}
            </dl>
            {!!data.current_catalog?.cats_without_photos && (
              <p className="text-sm">
                尚无参考照片的猫不会出现在识别候选中，请在猫档案中补充照片。
              </p>
            )}
            {!canManage && <p className="text-sm">审核员可查看状态；提交任务请联系管理员。</p>}
            {!data.store_configured && (
              <p className="text-sm">
                任务服务尚未启用。当前可查看独立参考版本，请联系维护人员配置后再重建。
              </p>
            )}
            {data.job_error && (
              <p role="alert" className="text-sm">
                {explanation(data.job_error.code, data.job_error.message)}
              </p>
            )}
            {canManage && (
              <button
                className={`${actionClass} w-full`}
                disabled={disabled || data.current_catalog?.photo_count === 0}
                onClick={() => void submit({ kind: 'rebuild', crop: true, publish: true })}
              >
                {pending ? '正在提交…' : '重建并发布'}
              </button>
            )}
            {data.current_catalog?.photo_count === 0 && (
              <p className="text-sm">还没有参考照片，请先在猫档案中上传。</p>
            )}
            {busy && (
              <p className="text-sm">
                已有任务等待或正在处理。页面每 5 秒刷新；长时间等待时请联系维护人员检查构建服务。
              </p>
            )}
            <details className="text-xs text-text-secondary">
              <summary className="cursor-pointer py-2">版本与诊断详情</summary>
              <div className="space-y-2 break-all">
                <p>校验代码：{data.code}</p>
                <p>
                  当前资料修订：{data.current_catalog?.generation ?? '未知'}；版本资料修订：
                  {data.published?.catalog_generation ?? '未知'}
                </p>
                {data.published?.publication_id && <p>发布 ID：{data.published.publication_id}</p>}
                {[data.catalog_error, data.publication_error, data.job_error].map(
                  (error, index) =>
                    error && (
                      <p key={index}>
                        {error.code}：{error.message}
                      </p>
                    )
                )}
              </div>
            </details>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold">最近任务</h3>
            {data.jobs.length === 0 && (
              <p className="text-sm text-text-secondary">
                {data.job_error
                  ? '任务记录暂不可读取。'
                  : '暂无任务。上传参考照片后，管理员可提交重建。'}
              </p>
            )}
            <ul className="divide-y divide-border">
              {data.jobs.map((job) => (
                <li key={job.job_id} className="py-4 space-y-2" data-testid={`job-${job.job_id}`}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-bold">
                      {kinds[job.kind]} · {job.job_id.slice(0, 8)}
                    </span>
                    <span>{jobLabel(job)}</span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {time(job.updated_at)}
                    {!job.crop ? ' · 无裁剪评测任务' : ''}
                    {job.kind === 'rebuild' && !job.publish ? ' · 仅生成候选' : ''}
                  </p>
                  {job.status === 'running' && (
                    <div className="space-y-1">
                      {job.total_photos > 0 && (
                        <progress
                          aria-label="照片处理进度"
                          max={job.total_photos}
                          value={job.completed_photos}
                          className="w-full"
                        />
                      )}
                      <p className="text-sm">
                        {job.total_photos === 0
                          ? '正在校验输入或准备发布…'
                          : `已处理 ${job.completed_photos} / ${job.total_photos} 张；完成后还需校验与发布。`}
                      </p>
                    </div>
                  )}
                  {(job.status === 'failed' || job.status === 'interrupted') && (
                    <>
                      <p className="text-sm">
                        {explanation(job.code, '任务未完成，请查看诊断，修复原因后重试。')}
                      </p>
                      {canManage && (
                        <button
                          className={actionClass}
                          disabled={disabled}
                          onClick={() => void submit(retryRequest(job))}
                        >
                          重试{kinds[job.kind]}任务
                        </button>
                      )}
                    </>
                  )}
                  <details className="text-xs text-text-secondary">
                    <summary className="cursor-pointer py-1">任务详情</summary>
                    <div className="space-y-1 break-all">
                      <p>ID：{job.job_id}</p>
                      <p>输入资料修订：{job.requested_generation}</p>
                      {job.snapshot_id && <p>产出版本：{job.snapshot_id}</p>}
                      {job.code && (
                        <p>
                          {job.code}：{job.detail ?? '无补充说明'}
                        </p>
                      )}
                      {job.status === 'succeeded' && (
                        <p>这是该次任务的历史结果，当前可用性以上方校验为准。</p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-secondary">
              最近核对：{time(data.checked_at)} · 最多显示 20 个任务
            </p>
          </div>
        </>
      )}
    </section>
  );
}
