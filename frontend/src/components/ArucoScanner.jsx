import React, { useEffect } from 'react';
import { useArucoScanner } from '../hooks/useArucoScanner';

export default function ArucoScanner({ onDetected, autoStart = false }) {
  const { videoRef, canvasRef, isScanning, startScanning, stopScanning, error } =
    useArucoScanner(onDetected);

  useEffect(() => {
    if (autoStart) {
      startScanning();
    }
    return () => stopScanning();
  }, [autoStart, startScanning, stopScanning]);

  return (
    <div className="aruco-scanner-wrap">
      {/* Video feed — fixed aspect-ratio box, overflow hidden, video forced to
          cover it. The camera stream's native resolution can never resize
          this box, regardless of device. */}
      <div className="aruco-frame">
        <video
          ref={videoRef}
          className="aruco-video"
          playsInline
          muted
        />
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="aruco-canvas-hidden" />

        {/* Overlay when not scanning */}
        {!isScanning && !error && (
          <div className="aruco-idle-overlay">
            <div className="aruco-idle-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Camera not started</p>
          </div>
        )}

        {/* Scanning indicator */}
        {isScanning && (
          <div className="aruco-scan-overlay">
            <div className="aruco-corner aruco-corner-tl" />
            <div className="aruco-corner aruco-corner-tr" />
            <div className="aruco-corner aruco-corner-bl" />
            <div className="aruco-corner aruco-corner-br" />
            <div className="aruco-scan-line" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="aruco-error-box">
          <span>{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="aruco-controls">
        {!isScanning ? (
          <button onClick={startScanning} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
            Start Scanning
          </button>
        ) : (
          <button onClick={stopScanning} className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop
          </button>
        )}
      </div>

      {isScanning && (
        <p className="aruco-hint">
          Point camera at the ArUco marker on your experiment card
        </p>
      )}
    </div>
  );
}