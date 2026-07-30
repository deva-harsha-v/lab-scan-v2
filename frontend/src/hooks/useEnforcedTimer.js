import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';

export function useEnforcedTimer({
  sessionId,
  videoId,
  initialProgress = 0,
  minDuration = 60,
  videoRef
}) {
  const [watchedSeconds, setWatchedSeconds] = useState(initialProgress);
  const [isTabActive, setIsTabActive] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(initialProgress >= minDuration);
  
  const timerRef = useRef(null);
  const lastSyncRef = useRef(initialProgress);

  useEffect(() => {
    setWatchedSeconds(initialProgress);
    setIsCompleted(initialProgress >= minDuration);
    // Auto-start timer when active video changes if not completed
    setIsPlaying(initialProgress < minDuration && isTabActive);
    lastSyncRef.current = initialProgress;
  }, [videoId]);

  // Sync to database if student session is active
  const syncProgress = async (currentProgress) => {
    if (!sessionId) return;
    try {
      await apiFetch('/sessions/progress', {
        method: 'PUT',
        body: JSON.stringify({
          session_id: sessionId,
          video_id: videoId,
          watched_seconds: currentProgress
        })
      });
      lastSyncRef.current = currentProgress;
    } catch (err) {
      console.error('Failed to sync video progress:', err);
    }
  };

  // Monitor visibility changes (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const active = document.visibilityState === 'visible';
      setIsTabActive(active);

      // Strict enforcement: if tab goes hidden, force pause the video
      if (!active) {
        setIsPlaying(false);
        if (videoRef && videoRef.current) {
          try {
            videoRef.current.pause();
          } catch (e) {
            console.warn('Could not pause video element:', e);
          }
        }
      } else {
        // Resume timer if student returns to tab and video isn't completed yet
        setWatchedSeconds((currentSec) => {
          if (currentSec < minDuration) {
            setIsPlaying(true);
          }
          return currentSec;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [videoRef, minDuration]);

  // Listen for YouTube Iframe API postMessage player events
  useEffect(() => {
    const handleWindowMessage = (event) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          data = JSON.parse(data);
        }
        if (data && data.event === 'infoDelivery' && data.info && typeof data.info.playerState !== 'undefined') {
          const state = data.info.playerState;
          if (state === 1) { // YouTube Playing
            if (isTabActive) setIsPlaying(true);
          } else if (state === 2 || state === 0) { // YouTube Paused or Ended
            setIsPlaying(false);
          }
        }
      } catch (e) {
        // Ignore non-JSON or unrelated postMessage events
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [isTabActive]);

  // Handle timer accumulation when active and playing
  useEffect(() => {
    if (isPlaying && isTabActive && !isCompleted) {
      timerRef.current = setInterval(() => {
        setWatchedSeconds((prev) => {
          const next = prev + 1;
          
          // Check completion
          if (next >= minDuration) {
            setIsCompleted(true);
            clearInterval(timerRef.current);
            syncProgress(next);
          }
          
          // Sync to backend every 5 seconds
          if (next - lastSyncRef.current >= 5) {
            syncProgress(next);
          }

          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, isTabActive, isCompleted, minDuration, sessionId, videoId]);

  // Keep ref of latest progress to use inside unmount cleanup without triggering effect re-registration
  const watchedSecondsRef = useRef(watchedSeconds);
  useEffect(() => {
    watchedSecondsRef.current = watchedSeconds;
  }, [watchedSeconds]);

  // Sync final status on unmount ONLY
  useEffect(() => {
    return () => {
      if (watchedSecondsRef.current !== lastSyncRef.current) {
        syncProgress(watchedSecondsRef.current);
      }
    };
  }, [sessionId, videoId]);

  // Attach event handlers to HTML5 video element
  useEffect(() => {
    const el = videoRef?.current;
    if (!el) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
    };

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);

    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [videoRef]);

  // Manual play/pause triggers for non-HTML5 video players (e.g. YouTube iframes)
  const setManualPlaying = (playing) => {
    // If tab is not active, do not allow starting
    if (playing && !isTabActive) return;
    setIsPlaying(playing);
  };

  return {
    watchedSeconds,
    isTabActive,
    isPlaying,
    isCompleted,
    setManualPlaying,
    progressPercentage: Math.min(100, (watchedSeconds / minDuration) * 100),
    remainingSeconds: Math.max(0, minDuration - watchedSeconds)
  };
}
