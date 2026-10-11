import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, getUser } from '../utils/api';
import { 
  ArrowLeft, Heading, AlignLeft, AlertTriangle, HelpCircle, 
  Video, CheckSquare, ChevronUp, ChevronDown, Trash, Save, Sparkles, Upload,
  BookOpen, Link, FileText, HelpCircle as QuestionIcon
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
  const [questionnaireItems, setQuestionnaireItems] = useState([]);
  const [bookReferences, setBookReferences] = useState([]);
  const [virtualLabLinks, setVirtualLabLinks] = useState([]);
  const [manualDocuments, setManualDocuments] = useState([]);
  const [versionNumber, setVersionNumber] = useState(1);
  
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
        setQuestionnaireItems(data.content.questionnaire_items || []);
        setBookReferences(data.content.book_references || []);
        setVirtualLabLinks(data.content.virtual_lab_links || []);
        setManualDocuments(data.content.manual_documents || []);
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

  // --- Questionnaire Handlers (Max 5) ---
  const addQuestionnaireItem = () => {
    if (questionnaireItems.length >= 5) {
      alert('Maximum of 5 questionnaire questions allowed per experiment.');
      return;
    }
    setQuestionnaireItems([
      ...questionnaireItems,
      { question_text: '', question_type: 'boolean', question_order: questionnaireItems.length + 1 }
    ]);
  };

  const updateQuestionnaireItem = (index, field, value) => {
    setQuestionnaireItems(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  };

  const removeQuestionnaireItem = (index) => {
    const updated = questionnaireItems.filter((_, i) => i !== index).map((q, i) => ({ ...q, question_order: i + 1 }));
    setQuestionnaireItems(updated);
  };

  // --- Book References Handlers ---
  const addBookReference = () => {
    setBookReferences([...bookReferences, { title: '', author: '', link: '' }]);
  };

  const updateBookReference = (index, field, value) => {
    setBookReferences(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const removeBookReference = (index) => {
    setBookReferences(bookReferences.filter((_, i) => i !== index));
  };

  // --- Virtual Lab Links Handlers ---
  const addVirtualLabLink = () => {
    setVirtualLabLinks([...virtualLabLinks, { title: '', url: '', provider_name: '', description: '' }]);
  };

  const updateVirtualLabLink = (index, field, value) => {
    setVirtualLabLinks(prev => prev.map((vl, i) => i === index ? { ...vl, [field]: value } : vl));
  };

  const removeVirtualLabLink = (index) => {
    setVirtualLabLinks(virtualLabLinks.filter((_, i) => i !== index));
  };

  // --- Manual Documents Handlers ---
  const addManualDocument = () => {
    setManualDocuments([...manualDocuments, { title: '', document_url: '', file_type: 'pdf' }]);
  };

  const updateManualDocument = (index, field, value) => {
    setManualDocuments(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const removeManualDocument = (index) => {
    setManualDocuments(manualDocuments.filter((_, i) => i !== index));
  };

  // --- Save / Publish ---
  const handleSave = async () => {
    // Validate empty links or fields
    const hasEmptyBlocks = theoryBlocks.some(b => !b.text.trim());
    const hasEmptyVideos = videoLinks.some(v => !v.url.trim() || !v.title.trim());
    const hasEmptyChecklist = checklistItems.some(i => !i.trim());
    const hasEmptyQuestions = questionnaireItems.some(q => !q.question_text.trim());
    const hasEmptyBooks = bookReferences.some(b => !b.title.trim() || !b.link.trim());
    const hasEmptyVirtualLabs = virtualLabLinks.some(vl => !vl.title.trim() || !vl.url.trim());
    const hasEmptyManuals = manualDocuments.some(d => !d.title.trim() || !d.document_url.trim());

    if (hasEmptyBlocks || hasEmptyVideos || hasEmptyChecklist || hasEmptyQuestions || hasEmptyBooks || hasEmptyVirtualLabs || hasEmptyManuals) {
      if (!confirm('You have empty or incomplete content fields. These will be published as blank/default values. Continue?')) {
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
        checklist_items: checklistItems,
        questionnaire_items: questionnaireItems.map((q, i) => ({ ...q, question_order: i + 1 })),
        book_references: bookReferences,
        virtual_lab_links: virtualLabLinks,
        manual_documents: manualDocuments
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

            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Other Stages & Resources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={addVideoLink}>
                <Video size={16} /> Add Video Resource
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={addBookReference}>
                <BookOpen size={16} /> Add Book Reference
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={addManualDocument}>
                <FileText size={16} /> Add Manual Document
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={addQuestionnaireItem} disabled={questionnaireItems.length >= 5}>
                <QuestionIcon size={16} /> Add Question ({questionnaireItems.length}/5)
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }} onClick={addVirtualLabLink}>
                <Link size={16} /> Add Virtual Lab Link
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

              {/* Book References Sub-Section */}
              <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#f8fafc', marginBottom: '14px' }}>
                  <BookOpen size={18} style={{ color: 'var(--accent-blue)' }} /> Book References (Displayed in Learn Stage)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bookReferences.map((book, index) => (
                    <div key={index} className="editor-block" style={{ padding: '16px', paddingRight: '48px', position: 'relative' }}>
                      <div className="grid-2" style={{ gap: '12px', marginBottom: '10px' }}>
                        <input 
                          type="text"
                          className="form-input"
                          value={book.title || ''}
                          onChange={(e) => updateBookReference(index, 'title', e.target.value)}
                          placeholder="Book Title (e.g. Physics for Engineers)"
                        />
                        <input 
                          type="text"
                          className="form-input"
                          value={book.author || ''}
                          onChange={(e) => updateBookReference(index, 'author', e.target.value)}
                          placeholder="Author(s) (e.g. Halliday & Resnick)"
                        />
                      </div>
                      <input 
                        type="text"
                        className="form-input"
                        value={book.link || ''}
                        onChange={(e) => updateBookReference(index, 'link', e.target.value)}
                        placeholder="Reference URL (e.g. https://...)"
                      />
                      <div className="editor-block-controls" style={{ top: '16px', right: '16px' }}>
                        <button className="editor-block-btn" style={{ color: 'var(--accent-red)' }} onClick={() => removeBookReference(index)}>
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {bookReferences.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No book references added yet. Click "Add Book Reference" on dock.
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Documents Sub-Section */}
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', color: '#f8fafc', marginBottom: '14px' }}>
                  <FileText size={18} style={{ color: 'var(--accent-blue)' }} /> Lab Manuals & Instructions (PDF Viewer Link)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {manualDocuments.map((doc, index) => (
                    <div key={index} className="editor-block" style={{ padding: '16px', paddingRight: '48px', position: 'relative' }}>
                      <div className="grid-2" style={{ gap: '12px', marginBottom: '10px' }}>
                        <input 
                          type="text"
                          className="form-input"
                          value={doc.title || ''}
                          onChange={(e) => updateManualDocument(index, 'title', e.target.value)}
                          placeholder="Document Title (e.g. Experiment 4 Lab Manual)"
                        />
                        <select 
                          className="form-input"
                          value={doc.file_type || 'pdf'}
                          onChange={(e) => updateManualDocument(index, 'file_type', e.target.value)}
                        >
                          <option value="pdf">PDF Document</option>
                          <option value="link">Web Document</option>
                        </select>
                      </div>
                      <input 
                        type="text"
                        className="form-input"
                        value={doc.document_url || ''}
                        onChange={(e) => updateManualDocument(index, 'document_url', e.target.value)}
                        placeholder="Document URL (e.g. https://drive.google.com/.../view or direct PDF URL)"
                      />
                      <div className="editor-block-controls" style={{ top: '16px', right: '16px' }}>
                        <button className="editor-block-btn" style={{ color: 'var(--accent-red)' }} onClick={() => removeManualDocument(index)}>
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {manualDocuments.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No manual documents added yet. Click "Add Manual Document" on dock.
                    </div>
                  )}
                </div>
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

                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label className="form-label">YouTube Video URL</label>
                      <input 
                        type="text" 
                        className="form-input"
                        value={vid.url || ''}
                        onChange={(e) => updateVideoLinkField(index, 'url', e.target.value)}
                        placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..."
                      />
                      <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        <strong>Compression Notice:</strong> For best results, compress your video using HandBrake (or similar encoder) before uploading to YouTube (Unlisted). Keep the file size under ~150MB for a 10–15 minute video to ensure fast streaming and zero buffering for mobile users in the lab.
                      </p>
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

            {/* Stage 3: Questionnaire (5 Questions Max) */}
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                  <QuestionIcon size={22} style={{ color: 'var(--accent-blue)' }} /> Stage 3: Experiment Questionnaire ({questionnaireItems.length}/5 Questions)
                </h3>
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={addQuestionnaireItem} disabled={questionnaireItems.length >= 5}>
                  + Add Question
                </button>
              </div>
              
              <div className="editor-workspace" style={{ minHeight: '120px' }}>
                {questionnaireItems.map((q, index) => (
                  <div key={index} className="editor-block" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                        Question #{index + 1}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <select 
                          className="form-input" 
                          style={{ width: 'auto', minWidth: '180px', padding: '6px 12px', fontSize: '0.85rem' }}
                          value={q.question_type}
                          onChange={(e) => updateQuestionnaireItem(index, 'question_type', e.target.value)}
                        >
                          <option value="boolean">Yes / No (Boolean)</option>
                          <option value="text">Short Text / Objective</option>
                        </select>
                        <button 
                          type="button"
                          className="editor-block-btn" 
                          style={{ color: 'var(--accent-red)', position: 'static', padding: '6px' }} 
                          onClick={() => removeQuestionnaireItem(index)}
                          title="Delete Question"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>

                    <input 
                      type="text" 
                      className="form-input"
                      value={q.question_text || ''}
                      onChange={(e) => updateQuestionnaireItem(index, 'question_text', e.target.value)}
                      placeholder={`Enter question text (e.g. ${q.question_type === 'boolean' ? 'Did you observe resonance at 50Hz?' : 'What was the calculated wavelength?'})`}
                    />
                  </div>
                ))}
                {questionnaireItems.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    No questionnaire questions added yet. Click "Add Question" in dock to add up to 5 questions.
                  </div>
                )}
              </div>
            </div>

            {/* Virtual Lab External Links Section */}
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                  <Link size={22} style={{ color: 'var(--accent-blue)' }} /> Virtual Lab External Links
                </h3>
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={addVirtualLabLink}>
                  + Add Link
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {virtualLabLinks.map((vl, index) => (
                  <div key={index} className="editor-block" style={{ padding: '16px', paddingRight: '48px', position: 'relative' }}>
                    <div className="grid-2" style={{ gap: '12px', marginBottom: '10px' }}>
                      <input 
                        type="text"
                        className="form-input"
                        value={vl.title || ''}
                        onChange={(e) => updateVirtualLabLink(index, 'title', e.target.value)}
                        placeholder="Link Title (e.g. Interactive Circuit Simulator)"
                      />
                      <input 
                        type="text"
                        className="form-input"
                        value={vl.provider_name || ''}
                        onChange={(e) => updateVirtualLabLink(index, 'provider_name', e.target.value)}
                        placeholder="Provider (e.g. PhET Interactive Simulations)"
                      />
                    </div>
                    <input 
                      type="text"
                      className="form-input"
                      value={vl.url || ''}
                      onChange={(e) => updateVirtualLabLink(index, 'url', e.target.value)}
                      placeholder="Virtual Lab URL (e.g. https://phet.colorado.edu/...)"
                    />
                    <div className="editor-block-controls" style={{ top: '16px', right: '16px' }}>
                      <button className="editor-block-btn" style={{ color: 'var(--accent-red)' }} onClick={() => removeVirtualLabLink(index)}>
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {virtualLabLinks.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    No virtual lab links added yet. Click "Add Virtual Lab Link" in dock.
                  </div>
                )}
              </div>
            </div>

            {/* Stage 4: Checklist Items */}
            <div className="glass-panel">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <CheckSquare size={22} style={{ color: 'var(--accent-blue)' }} /> Stage 4: Verification Checklist
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
