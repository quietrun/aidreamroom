import { useCallback, useEffect, useRef, useState } from 'react';

const preloadedVideoSources = new Set();
const retainedVideoPreloaders = new Map();

export function preloadVideoAsset(src) {
  if (!src || typeof document === 'undefined') {
    return;
  }

  if (preloadedVideoSources.has(src)) {
    return;
  }

  preloadedVideoSources.add(src);

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'video';
  link.href = src;
  link.setAttribute('fetchpriority', 'high');
  link.setAttribute('data-aidr-preload-video', src);
  document.head.appendChild(link);

  const video = document.createElement('video');
  video.preload = 'auto';
  video.src = src;
  video.playsInline = true;
  video.load();
  retainedVideoPreloaders.set(src, video);
}

export function useLoadingVideoTransition(videoSrc) {
  const videoRef = useRef(null);
  const transitionResolverRef = useRef(null);
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [transitionCompleted, setTransitionCompleted] = useState(false);

  const resolveTransition = useCallback(() => {
    if (transitionResolverRef.current) {
      const resolve = transitionResolverRef.current;
      transitionResolverRef.current = null;
      resolve();
    }
  }, []);

  const resetVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.pause();

    try {
      video.currentTime = 0;
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleTransitionComplete = useCallback(() => {
    setTransitionCompleted(true);
    resolveTransition();
  }, [resolveTransition]);

  const startTransition = useCallback(() => {
    preloadVideoAsset(videoSrc);
    resolveTransition();
    setTransitionCompleted(false);
    setTransitionVisible(true);

    const promise = new Promise((resolve) => {
      transitionResolverRef.current = resolve;
    });

    const video = videoRef.current;
    if (!video) {
      handleTransitionComplete();
      return promise;
    }

    resetVideo();

    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch((error) => {
        console.error(error);
        handleTransitionComplete();
      });
    }

    return promise;
  }, [handleTransitionComplete, resetVideo, resolveTransition, videoSrc]);

  const cancelTransition = useCallback(() => {
    resetVideo();
    setTransitionVisible(false);
    setTransitionCompleted(false);
    resolveTransition();
  }, [resetVideo, resolveTransition]);

  useEffect(() => {
    preloadVideoAsset(videoSrc);
  }, [videoSrc]);

  useEffect(
    () => () => {
      resolveTransition();
    },
    [resolveTransition],
  );

  return {
    videoRef,
    transitionVisible,
    transitionCompleted,
    startTransition,
    cancelTransition,
    handleVideoEnded: handleTransitionComplete,
    handleVideoError: handleTransitionComplete,
  };
}
