export default function RecognizeModal({ result, onClose, onViewCat, onConfirmCandidate }) {
  const confidence = Math.round((result.confidence || 0) * 100)
  const candidates = result.candidates || []

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="clay-card w-full max-w-sm p-8 text-center space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl">
          {result.status === 'unknown' ? '🌟' : '🐾'}
        </div>

        {result.status === 'confirmed' && (
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-text">
              发现 {result.cat_name}！
            </h2>
            <p className="text-text-secondary font-body">
              匹配度：{confidence}%
            </p>
          </div>
        )}

        {result.status === 'uncertain' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-text">
                可能是这几只猫
              </h2>
              <p className="text-text-secondary font-body text-sm">
                匹配度不够确定，请帮忙确认一下
              </p>
            </div>
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.cat_id}
                  onClick={() => onConfirmCandidate(candidate)}
                  className="w-full p-3 rounded-2xl border-3 border-border bg-card text-left flex items-center justify-between active:scale-97 transition-transform"
                >
                  <span className="font-bold text-text">{candidate.cat_name}</span>
                  <span className="text-sm text-text-secondary">
                    {Math.round(candidate.confidence * 100)}%
                  </span>
                </button>
              ))}
              {candidates.length === 0 && (
                <p className="text-sm text-text-secondary py-2">
                  暂时没有候选结果，请重新拍摄一张更清晰的照片。
                </p>
              )}
            </div>
          </div>
        )}

        {result.status === 'unknown' && (
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-text">
              发现新朋友！
            </h2>
            <p className="text-text-secondary font-body text-sm leading-relaxed">
              这张照片暂时没有匹配到已有档案，可以先提交给猫协后续审核入库。
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {result.status === 'confirmed' && result.cat_id && (
            <button
              onClick={() => onViewCat(result.cat_id)}
              className="clay-btn w-full"
            >
              查看档案
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl border-3 border-border font-bold text-text-secondary bg-card
                       shadow-[4px_4px_8px_oklch(85%_0.01_80),-2px_-2px_6px_oklch(100%_0_0),inset_0_1px_2px_oklch(100%_0_0)]
                       active:shadow-[inset_2px_2px_4px_oklch(85%_0.01_80),inset_-1px_-1px_3px_oklch(100%_0_0)]
                       active:scale-97 transition-all duration-150"
          >
            继续拍照
          </button>
        </div>
      </div>
    </div>
  )
}
