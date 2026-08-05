import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, getUser } from '../utils/api';
import { 
  ArrowLeft, Heading, AlignLeft, AlertTriangle, HelpCircle, 
  Video, CheckSquare, ChevronUp, ChevronDown, Trash, Save, Sparkles, Upload 
} from 'lucide-react';
import LabScanLogo from '../components/LabScanLogo';
import Skeleton from '../components/Skeleton';

export default function AdminEditor() {
  const { experimentId } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const [experiment, setExperiment] = useState(null);
  const [theoryBlocks, setTheoryBlocks] = useState([]);
  const [videoLinks, setVideoLinks] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [versionNumber, setVersionNumber] = useState(1);
  const [uploadingState, setUploadingState] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }

    // Fetch the latest content version
    apiFetch(`/experiments/${experimentId}`)
      .then(data => {
        setExperiment(data.experiment);
        setTheoryBlocks(data.content.theory_procedure_json || []);
        setVideoLinks(data.content.video_links || []);
        setChecklistItems(data.content.checklist_items.map(item => item.item_text) || []);
        setVersionNumber(data.content.version_number || 1);
        setLoading(false);
      })
      .catch(err => {
        alert('Failed to load experiment content: ' + err.message);
        navigate('/admin/dashboard');
      });
  }, [experimentId, navigate]);

  // --- Theory Blocks Handlers ---
  const addTheoryBlock = (type) => {
    setTheoryBlocks([...theoryBlocks, { type, text: '' }]);
  };

  const updateTheoryBlockText = (index, text) => {
    setTheoryBlocks(prev => prev.map((b, i) => i === index ? { ...b, text } : b));
  };

  const removeTheoryBlock = (index) => {
    setTheoryBlocks(theoryBlocks.filter((_, i) => i !== index));
  };

  const moveTheoryBlock = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === theoryBlocks.length - 1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...theoryBlocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setTheoryBlocks(updated);
  };

  // --- Video Links Handlers ---
  const addVideoLink = () => {
    setVideoLinks([
      ...videoLinks, 
      { id: 'vid-' + Date.now(), type: 'youtube', url: '', title: '', min_duration: 60 }
    ]);
  };

  const updateVideoLinkField = (index, field, value) => {
    setVideoLinks(prev => prev.map((vid, i) => {
      if (i === index) {
        const newVid = { ...vid, [field]: value };
        if (field === 'type') {
          newVid.min_duration = value === 'faculty' ? 300 : 60;
        }
        return newVid;
      }
      return vid;
    }));
  };

  const removeVideoLink = (index) => {
    setVideoLinks(videoLinks.filter((_, i) => i !== index));
  };

  const handleUploadVideo = (index, file, vidId) => {
    if (!file) return;

    // Validate MP4
    if (!file.name.toLowerCase().endsWith('.mp4') && file.type !== 'video/mp4') {
      setUploadingState(prev => ({
        ...prev,
        [vidId]: { loading: false, progress: 0, error: 'Only .mp4 video files are accepted.' }
      }));
      return;
    }

    // Validate size (50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadingState(prev => ({
        ...prev,
        [vidId]: { loading: false, progress: 0, error: 'File size exceeds the 50MB limit.' }
      }));
      return;
    }

    setUploadingState(prev => ({
      ...prev,
      [vidId]: { loading: true, progress: 0, error: '' }
    }));

    const formData = new FormData();
    formData.append('video', file);

    const token = localStorage.getItem('token') || document.cookie.match(/token=([^;]+)/)?.[1];
    const xhr = new XMLHttpRequest();
    
    xhr.open('POST', '/api/experiments/video/upload');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadingState(prev => ({
          ...prev,
          [vidId]: { ...prev[vidId], progress: percent }
        }));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          updateVideoLinkField(index, 'url', res.url);
          setUploadingState(prev => ({
            ...prev,
            [vidId]: { loading: false, progress: 100, error: '' }
          }));
        } catch (e) {
          setUploadingState(prev => ({
            ...prev,
            [vidId]: { loading: false, progress: 0, error: 'Failed to parse server response.' }
          }));
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          setUploadingState(prev => ({
            ...prev,
            [vidId]: { loading: false, progress: 0, error: res.error || 'Server upload failed.' }
          }));
        } catch (e) {
          setUploadingState(prev => ({
            ...prev,
            [vidId]: { loading: false, progress: 0, error: `Upload failed (Status: ${xhr.status})` }
          }));
        }
      }
    };

    xhr.onerror = () => {
      setUploadingState(prev => ({
        ...prev,
        [vidId]: { loading: false, progress: 0, error: 'Network error occurred during upload.' }
      }));
    };

    xhr.send(formData);
  };

  // --- Checklist Items Handlers ---
  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, '']);
  };

  const updateChecklistItemText = (index, text) => {
    const updated = [...checklistItems];
    updated[index] = text;
    setChecklistItems(updated);
  };

  const removeChecklistItem = (index) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const moveChecklistItem = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === checklistItems.length - 1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...checklistItems];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setChecklistItems(updated);
  };

  // --- Save / Publish ---
  const handleSave = async () => {
    // Validate empty links or fields
    const hasEmptyBlocks = theoryBlocks.some(b => !b.text.trim());
    const hasEmptyVideos = videoLinks.some(v => !v.url.trim() || !v.title.trim());
    const hasEmptyChecklist = checklistItems.some(i => !i.trim());

    if (hasEmptyBlocks || hasEmptyVideos || hasEmptyChecklist) {
      if (!confirm('You have empty content fields. These will be published as blank values. Continue?')) {
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        experiment_name: experiment.experiment_name,
        description: experiment.description,
        ar_qr_marker_id: experiment.ar_qr_marker_id,
        theory_procedure_json: theoryBlocks,
        video_links: videoLinks,
        checklist_items: checklistItems
      };

      const result = await apiFetch(`/experiments/${experimentId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setSaving(false);
      alert(`Content updated! ${result.version_bumped ? `Published new version ${result.version_bumped}.` : 'Metadata updated.'}`);
      
      // Reload page to refresh version number and content
      window.location.reload();
    } catch (err) {
      alert('Error saving content: ' + err.message);
      setSaving(false);
    }
  };



  return (
    <div className="fade-in" style={{ paddingBottom: '100px' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <div className="navbar-brand" style={{ gap: '8px' }}>
            <LabScanLogo size={26} /> LabScan <span>Editor</span>
          </div>
          <div className="navbar-nav">
            <button className="btn btn-secondary" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft size={16} /> Console Dashboard
            </button>
            <button className="btn btn-success" style={{ gap: '8px' }} onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save & Publish'}
            </button>
          </div>
        </div>
      </nav>

      {/* Editor Workspace */}
      <div className="container" style={{ marginTop: '30px', textAlign: 'left' }}>
        {loading ? (
          <>
            {/* Header / Info Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <Skeleton variant="text" width="280px" height="24px" />
              <Skeleton variant="text" width="160px" height="12px" style={{ marginTop: '4px' }} />
            </div>

            {/* Theory blocks container skeleton */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <Skeleton variant="text" width="140px" height="18px" />
                <Skeleton variant="text" width="100px" height="32px" style={{ borderRadius: '999px' }} />
              </div>
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px', height: '180px' }}>
                <Skeleton variant="text" width="30%" height="16px" />
                <Skeleton variant="text" width="100%" height="80px" style={{ marginTop: '12px', borderRadius: '8px' }} />
              </div>
            </div>

            {/* Video trial links container skeleton */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <Skeleton variant="text" width="160px" height="18px" />
                <Skeleton variant="text" width="100px" height="32px" style={{ borderRadius: '999px' }} />
              </div>
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px', height: '100px', display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center' }}>
                <Skeleton variant="text" width="40%" height="32px" style={{ borderRadius: '8px' }} />
                <Skeleton variant="text" width="40%" height="32px" style={{ borderRadius: '8px' }} />
                <Skeleton variant="circle" width="32px" height="32px" />
              </div>
            </div>

            {/* Checklist items container skeleton */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <Skeleton variant="text" width="180px" height="18px" />
                <Skeleton variant="text" width="100px" height="32px" style={{ borderRadius: '999px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', height: '60px', display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'center' }}>
                    <Skeleton variant="circle" width="20px" height="20px" />
                    <Skeleton variant="text" width="60%" height="12px" />
                    <Skeleton variant="circle" width="24px" height="24px" style={{ marginLeft: 'auto' }} />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', textTransform: 'uppercase', fontWeight: 600 }}>
            Active Edition: Version {versionNumber}
          </span>
          <h2 style={{ fontSize: '2rem', marginTop: '4px' }}>{experiment?.experiment_name}</h2>
          <p style={{ fontSize: '0.95rem' }}>Modify and arrange structured information blocks. Editing creates a new snapshot version, protecting current student sessions from changes.</p>
        </div>

        <div className="editor-grid">
          {/* Controls / Blocks Dock */}
          <div className="glass-panel editor-sidebar">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theory Elements</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={() => addTheoryBlock('heading')}>
                <Heading size={16} /> Heading Block
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={() => addTheoryBlock('text')}>
                <AlignLeft size={16} /> Text Block
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={() => addTheoryBlock('equation')}>
                <HelpCircle size={16} /> Equation Code
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={() => addTheoryBlock('warning')}>
                <AlertTriangle size={16} style={{ color: 'var(--accent-warning)' }} /> Warning Banner
              </button>
            </div>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Other Stages</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={addVideoLink}>
                <Video size={16} /> Add Video Resource
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={addChecklistItem}>
                <CheckSquare size={16} /> Add Checklist Item
              </button>
            </div>
          </div>

          {/* Canvas Workspace */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Stage 1: Theory blocks */}
            <div className="glass-panel">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <AlignLeft size={22} style={{ color: 'var(--accent-blue)' }} /> Stage 1: Theory & Procedure Content
              </h3>
              
              <div className="editor-workspace">
                {theoryBlocks.map((block, index) => (
                  <div key={index} className="editor-block">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {block.type} Element
                    </span>

                    <div style={{ marginTop: '8px' }}>
                      {block.type === 'heading' && (
                        <input 
                          type="text" 
                          className="form-input" 
                          value={block.text}
                          onChange={(e) => updateTheoryBlockText(index, e.target.value)}
                          placeholder="Enter Heading Text..."
                        />
                      )}
                      {block.type === 'text' && (
                        <textarea 
                          className="form-input" 
                          value={block.text}
                          onChange={(e) => updateTheoryBlockText(index, e.target.value)}
                          placeholder="Enter body text (Markdown or plain text)..."
                          rows={4}
                        />
                      )}
                      {block.type === 'equation' && (
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ fontFamily: 'monospace' }}
                          value={block.text}
                          onChange={(e) => updateTheoryBlockText(index, e.target.value)}
                          placeholder="e.g. E = m * c^2"
                        />
                      )}
                      {block.type === 'warning' && (
                        <input 
                          type="text" 
                          className="form-input" 
                          value={block.text}
                          onChange={(e) => updateTheoryBlockText(index, e.target.value)}
                          placeholder="Enter warning/precautionary guidelines..."
                        />
                      )}
                    </div>

                    <div className="editor-block-controls">
                      <button className="editor-block-btn" onClick={() => moveTheoryBlock(index, 'up')}>
                        <ChevronUp size={16} />
                      </button>
                      <button className="editor-block-btn" onClick={() => moveTheoryBlock(index, 'down')}>
                        <ChevronDown size={16} />
                      </button>
                      <button className="editor-block-btn" style={{ color: 'var(--accent-red)' }} onClick={() => removeTheoryBlock(index)}>
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {theoryBlocks.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                    Workspace is empty. Click elements on the left panel to build content.
                  </div>
                )}
              </div>
            </div>

            {/* Stage 2: Video resources */}
            <div className="glass-panel">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Video size={22} style={{ color: 'var(--accent-blue)' }} /> Stage 2: Enforced Visual Resources
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {videoLinks.map((vid, index) => (
                  <div key={vid.id || index} className="editor-block" style={{ padding: '20px' }}>
                    <div className="grid-2" style={{ gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Video Title</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={vid.title || ''}
                          onChange={(e) => updateVideoLinkField(index, 'title', e.target.value)}
                          placeholder="e.g. Lab Demonstration Video"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Minimum Viewing Timer (Seconds)</label>
                        <input 
                          type="number" 
                          className="form-input"
                          value={vid.min_duration || 60}
                          onChange={(e) => updateVideoLinkField(index, 'min_duration', parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Upload Video Resource (.mp4, max 50MB)</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <label 
                            className="academic-btn btn-academic-secondary pill"
                            style={{ 
                              cursor: 'pointer', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              margin: 0,
                              padding: '10px 18px',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              border: '1px solid var(--border-color)',
                              background: 'transparent',
                              color: '#d1d5db'
                            }}
                          >
                            <Upload size={16} /> Choose Video File
                            <input 
                              type="file" 
                              accept="video/mp4"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadVideo(index, file, vid.id);
                              }}
                              style={{ display: 'none' }}
                            />
                          </label>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {vid.url ? '✓ Video uploaded' : 'No video file chosen'}
                          </span>
                        </div>

                        {/* Upload Status & Progress */}
                        {uploadingState[vid.id] && (
                          <div style={{ background: 'var(--surface-l2)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                            {uploadingState[vid.id].loading && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: 'var(--text-primary)' }}>
                                  <span>Uploading video...</span>
                                  <span>{uploadingState[vid.id].progress}%</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${uploadingState[vid.id].progress}%`, height: '100%', background: '#2563eb', transition: 'width 0.1s ease' }} />
                                </div>
                              </div>
                            )}
                            {uploadingState[vid.id].error && (
                              <div style={{ color: 'var(--danger-red)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={14} /> {uploadingState[vid.id].error}
                              </div>
                            )}
                            {uploadingState[vid.id].progress === 100 && !uploadingState[vid.id].loading && !uploadingState[vid.id].error && (
                              <div style={{ color: 'var(--success-emerald)', fontSize: '13px', fontWeight: 600 }}>
                                ✓ Upload Completed successfully!
                              </div>
                            )}
                          </div>
                        )}

                        {/* Preview Player */}
                        {vid.url && (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Video Preview:</div>
                            <video 
                              src={vid.url} 
                              controls 
                              playsInline
                              style={{ width: '100%', maxHeight: '200px', borderRadius: '6px', background: '#000000', display: 'block', border: '1px solid var(--border-color)' }} 
                            />
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>
                              Public URL: <a href={vid.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{vid.url}</a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="editor-block-controls" style={{ top: '20px', right: '20px' }}>
                      <button className="editor-block-btn" style={{ color: 'var(--accent-red)' }} onClick={() => removeVideoLink(index)}>
                        <Trash size={16} /> Remove Resource
                      </button>
                    </div>
                  </div>
                ))}
                {videoLinks.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    No video links added yet. Click "Add Video Resource" in dock.
                  </div>
                )}
              </div>
            </div>

            {/* Stage 3: Checklist Items */}
            <div className="glass-panel">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <CheckSquare size={22} style={{ color: 'var(--accent-blue)' }} /> Stage 3: Verification Checklist
              </h3>
              
              <div className="editor-workspace" style={{ minHeight: '150px' }}>
                {checklistItems.map((item, index) => (
                  <div key={index} className="editor-block" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{index + 1}.</span>
                    <input 
                      type="text" 
                      className="form-input"
                      value={item}
                      onChange={(e) => updateChecklistItemText(index, e.target.value)}
                      placeholder="e.g. Clear the apparatus after completing steps."
                    />
                    
                    <div className="editor-block-controls" style={{ position: 'static' }}>
                      <button className="editor-block-btn" onClick={() => moveChecklistItem(index, 'up')}>
                        <ChevronUp size={16} />
                      </button>
                      <button className="editor-block-btn" onClick={() => moveChecklistItem(index, 'down')}>
                        <ChevronDown size={16} />
                      </button>
                      <button className="editor-block-btn" style={{ color: 'var(--accent-red)' }} onClick={() => removeChecklistItem(index)}>
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {checklistItems.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    No checklist items added. Click "Add Checklist Item" in dock.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
