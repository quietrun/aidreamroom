export function LoadingVideoOverlay({
  src,
  visible,
  completed,
  videoRef,
  onEnded,
  onError,
  mobile = false,
  tip = '梦境载入中...',
  completedTip = '梦境连接中...',
}) {
  return (
    <div
      className={`loading-video-overlay${visible ? ' is-visible' : ''}${mobile ? ' mobile' : ''}`}
      aria-hidden={!visible}
    >
      <video
        ref={videoRef}
        className="loading-video-overlay__video"
        src={src}
        preload="auto"
        playsInline
        onEnded={onEnded}
        onError={onError}
      />
      <div className="loading-video-overlay__shade" />
      <div className="loading-video-overlay__status">
        <span>{completed ? completedTip : tip}</span>
      </div>
    </div>
  );
}
