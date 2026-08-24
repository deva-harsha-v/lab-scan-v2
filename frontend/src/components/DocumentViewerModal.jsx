import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, FileText, Download, ShieldCheck } from 'lucide-react';

const font = { mono: "'Space Mono', monospace", sans: "'Outfit', sans-serif" };

export default function DocumentViewerModal({ isOpen, onClose, documentUrl, documentTitle }) {
  if (!isOpen || !documentUrl) return null;

  // Format link for embedding if Google Drive view link or standard PDF
  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com') && url.includes('/view')) {
      return url.replace('/view', '/preview');
    }
    return url;
  };

  const embedUrl = getEmbedUrl(documentUrl);

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(5, 8, 15, 0.85)',
        backdropFilter: 'blur(12px)',
        padding: '24px'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          style={{
            width: '100%',
            maxWidth: '1000px',
            height: '88vh',
            backgroundColor: '#0c121e',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header Bar */}
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8'
              }}>
                <FileText size={18} />
              </div>
              <div>
                <h3 style={{
                  fontFamily: font.sans,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#f8fafc',
                  margin: 0
                }}>
                  {documentTitle || 'Lab Manual & Procedure Guide'}
                </h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: font.mono,
                  fontSize: '11px',
                  color: '#38bdf8',
                  marginTop: '2px'
                }}>
                  <ShieldCheck size={12} /> Official Academic Reference Document
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  fontFamily: font.sans,
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
              >
                Open Original <ExternalLink size={14} />
              </a>

              <button
                onClick={onClose}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Document Viewer Frame */}
          <div style={{ flex: 1, backgroundColor: '#05080f', position: 'relative' }}>
            <iframe
              src={embedUrl}
              title={documentTitle || 'Lab Manual Document'}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
