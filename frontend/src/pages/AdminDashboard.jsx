import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getUser, clearSession } from '../utils/api';
import { 
  ShieldCheck, LogOut, Plus, Edit, Trash2, Layers, FileText, Upload, Download, 
  Search, X, ChevronLeft, ChevronRight, Landmark, Eye, EyeOff, Grid, BarChart3, Settings, Users, BookOpen
} from 'lucide-react';
import { getArucoGrid } from '../utils/arucoGenerator';
import ThemeToggle from '../components/ThemeToggle';
import LabScanLogo from '../components/LabScanLogo';
import SidebarRail from '../components/bento/SidebarRail';
import GlassCard from '../components/bento/GlassCard';
import ProgressRing from '../components/bento/ProgressRing';
import StatusPill from '../components/bento/StatusPill';
import GreetingHero from '../components/bento/GreetingHero';
import Skeleton from '../components/Skeleton';
import * as XLSX from 'xlsx';

const font = { mono: "'Space Mono', monospace", sans: "'Outfit', sans-serif" };

function formatAuditDetails(details) {
  if (!details) return '-';
  let parsed = details;
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
    } catch (e) {
      return details;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return String(parsed);
  }

  if (parsed.message && Object.keys(parsed).length === 1) {
    return parsed.message;
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return '-';

  return entries
    .map(([key, val]) => {
      const formattedKey = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      const formattedVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `${formattedKey}: ${formattedVal}`;
    })
    .join(' | ');
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('labs'); // labs, experiments, students, settings, audit
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [labs, setLabs] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const handleFocusIn = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        setIsInputFocused(true);
      }
    };
    const handleFocusOut = (e) => {
      setIsInputFocused(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const scrollToSection = (elementId) => {
    setIsSpeedDialOpen(false); // Close speed dial
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add visual highlight flash
      el.style.transition = 'all 0.5s ease';
      el.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.4)';
      setTimeout(() => {
        el.style.boxShadow = 'none';
      }, 1500);
    }
  };
  
  // Centralized Branches & Institution States
  const [branches, setBranches] = useState([]);
  const [institution, setInstitution] = useState({ name: '', short_name: '', logo: '' });
  const [adminProfile, setAdminProfile] = useState({ username: '', full_name: '', password: '' });

  // Student Management & Pagination States
  const [students, setStudents] = useState([]);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsLimit] = useState(10);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsBranchFilter, setStudentsBranchFilter] = useState('');
  const [studentsPwFilter, setStudentsPwFilter] = useState('');
  const [studentPagination, setStudentPagination] = useState({ page: 1, limit: 10, totalRecords: 0, totalPages: 1 });
  const [studentSummary, setStudentSummary] = useState({ totalStudents: 0, totalBranches: 0, activeStudents: 0, importedToday: 0, pendingPasswordChange: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals / Forms States
  const [labForm, setLabForm] = useState({ id: null, lab_name: '', description: '', location: '', allowed_branches: [] });
  const [expForm, setExpForm] = useState({ id: null, lab_id: '', experiment_name: '', description: '', ar_qr_marker_id: '' });
  
  // Single manual student form
  const [studentForm, setStudentForm] = useState({ full_name: '', roll_number: '', branch_id: '', password: '' });
  const [editStudentForm, setEditStudentForm] = useState(null); // { user_id, full_name, branch_id }
  const [resetPwForm, setResetPwForm] = useState(null); // { user_id, roll_number, password }
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Dynamic Branch Management form
  const [branchFormName, setBranchFormName] = useState('');
  const [editBranchId, setEditBranchId] = useState(null);
  const [editBranchName, setEditBranchName] = useState('');

  // Bulk Excel Import States
  const [importFile, setImportFile] = useState(null);
  const [importRowCount, setImportRowCount] = useState(null);
  const [importPassword, setImportPassword] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!importFile) {
      setImportRowCount(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setImportRowCount(json.length);
      } catch (err) {
        console.error('Error reading excel file row count:', err);
        setImportRowCount(0);
      }
    };
    reader.readAsArrayBuffer(importFile);
  }, [importFile]);

  // Student Profile Drawer
  const [drawerStudentId, setDrawerStudentId] = useState(null);
  const [studentDrawerInfo, setStudentDrawerInfo] = useState(null);

  // Show/Hide Password Toggle States
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [showCreateStudentPassword, setShowCreateStudentPassword] = useState(false);
  const [showResetStudentPassword, setShowResetStudentPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const navigate = useNavigate();
  const user = getUser();

  const loadData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const labsData = await apiFetch('/labs');
      setLabs(labsData);
      
      const expsData = await apiFetch('/experiments');
      setExperiments(expsData);

      const logsData = await apiFetch('/audit-logs');
      setAuditLogs(logsData);

      const branchesData = await apiFetch('/branches');
      setBranches(branchesData);

      const instData = await apiFetch('/institutions');
      setInstitution(instData);

      const profData = await apiFetch('/auth/profile');
      setAdminProfile({ username: profData.username || 'admin', full_name: profData.full_name || '', password: '' });

      await loadStudentsData(studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const loadStudentsData = async (page, search, branchId, pwFilter) => {
    try {
      const qs = new URLSearchParams({
        page: page.toString(),
        limit: studentsLimit.toString(),
        search,
        branch_id: branchId,
        force_password_change: pwFilter
      }).toString();

      const data = await apiFetch(`/auth/students?${qs}`);
      setStudents(data.students || []);
      setStudentPagination(data.pagination || { page: 1, limit: 10, totalRecords: 0, totalPages: 1 });
      if (data.summary) {
        setStudentSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching students list:', err);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    loadData(true);
  }, [navigate]);

  useEffect(() => {
    if (!loading) {
      loadStudentsData(studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter);
    }
  }, [studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter]);

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  // --- CRUD Labs with Allowed Branches ---
  const handleLabSubmit = async (e) => {
    e.preventDefault();
    if (!labForm.lab_name) return;
    try {
      if (labForm.id) {
        await apiFetch(`/labs/${labForm.id}`, {
          method: 'PUT',
          body: JSON.stringify({ 
            lab_name: labForm.lab_name, 
            description: labForm.description,
            location: labForm.location,
            allowed_branches: labForm.allowed_branches
          })
        });
      } else {
        await apiFetch('/labs', {
          method: 'POST',
          body: JSON.stringify({ 
            lab_name: labForm.lab_name, 
            description: labForm.description,
            location: labForm.location,
            allowed_branches: labForm.allowed_branches
          })
        });
      }
      setLabForm({ id: null, lab_name: '', description: '', location: '', allowed_branches: [] });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLabDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this lab?')) return;
    try {
      await apiFetch(`/labs/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleBranchSelection = (branchId) => {
    let current = [...labForm.allowed_branches];
    if (current.includes(branchId)) {
      current = current.filter(id => id !== branchId);
    } else {
      current.push(branchId);
    }
    setLabForm({ ...labForm, allowed_branches: current });
  };

  const toggleSelectAllBranches = (isChecked) => {
    if (isChecked) {
      const allIds = branches.map(b => b.branch_id);
      setLabForm({ ...labForm, allowed_branches: allIds });
    } else {
      setLabForm({ ...labForm, allowed_branches: [] });
    }
  };

  // --- CRUD Experiments ---
  const handleExpSubmit = async (e) => {
    e.preventDefault();
    const { id, lab_id, experiment_name, description, ar_qr_marker_id } = expForm;
    if (!lab_id || !experiment_name || !ar_qr_marker_id) return;
    try {
      if (id) {
        await apiFetch(`/experiments/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ experiment_name, description, ar_qr_marker_id })
        });
      } else {
        await apiFetch('/experiments', {
          method: 'POST',
          body: JSON.stringify({ lab_id, experiment_name, description, ar_qr_marker_id })
        });
      }
      setExpForm({ id: null, lab_id: '', experiment_name: '', description: '', ar_qr_marker_id: '' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExpDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this experiment?')) return;
    try {
      await apiFetch(`/experiments/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- CRUD Centralized Branches ---
  const handleBranchAdd = async (e) => {
    e.preventDefault();
    if (!branchFormName.trim()) return;
    try {
      await apiFetch('/branches', {
        method: 'POST',
        body: JSON.stringify({ name: branchFormName.trim() })
      });
      setBranchFormName('');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBranchUpdate = async (e) => {
    e.preventDefault();
    if (!editBranchName.trim() || !editBranchId) return;
    try {
      await apiFetch(`/branches/${editBranchId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editBranchName.trim() })
      });
      setEditBranchId(null);
      setEditBranchName('');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBranchDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this branch? Centralized constraints will be verified.')) return;
    try {
      await apiFetch(`/branches/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- Institution & Admin profile update ---
  const handleAdminProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/auth/admin-profile', {
        method: 'PUT',
        body: JSON.stringify({
          username: adminProfile.username,
          full_name: adminProfile.full_name,
          password: adminProfile.password || undefined,
          institution_name: institution.name,
          institution_short_name: institution.short_name,
          institution_logo: institution.logo
        })
      });
      if (res && res.accessToken && res.user) {
        setSession(res.accessToken, res.refreshToken || '', res.user);
      }
      setAdminProfile({ ...adminProfile, password: '' });
      alert('Institution settings and Profile updated successfully.');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- CRUD Student Accounts ---
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    const { full_name, roll_number, branch_id, password } = studentForm;
    if (!full_name || !roll_number || !branch_id || !password) return;
    try {
      await apiFetch('/auth/register-student', {
        method: 'POST',
        body: JSON.stringify({ full_name, roll_number, branch_id, password })
      });
      setStudentForm({ full_name: '', roll_number: '', branch_id: '', password: '' });
      loadStudentsData(studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/auth/students/${editStudentForm.user_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: editStudentForm.full_name,
          branch_id: editStudentForm.branch_id
        })
      });
      setEditStudentForm(null);
      loadStudentsData(studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/auth/students/${resetPwForm.user_id}/reset-password`, {
        method: 'PUT',
        body: JSON.stringify({ password: resetPwForm.password })
      });
      setResetPwForm(null);
      alert('Password reset completed successfully. User flag forced reset.');
      loadStudentsData(studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStudentDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this student account? This operation is logged.')) return;
    try {
      await apiFetch(`/auth/students/${id}`, { method: 'DELETE' });
      loadStudentsData(studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter);
    } catch (err) {
      alert(err.message);
    }
  };

  // --- Student Drawer Profile Fetch ---
  const handleViewStudentDrawer = async (studentId) => {
    setDrawerStudentId(studentId);
    setStudentDrawerInfo(null);
    try {
      const data = await apiFetch(`/auth/student-profile/${studentId}`);
      setStudentDrawerInfo(data);
    } catch (err) {
      console.error(err.message);
    }
  };

  // --- Excel Bulk Import handlers ---
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setImportFile(e.dataTransfer.files[0]);
      setImportResult(null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleExcelImport = () => {
    if (!importFile) {
      alert('Please choose an Excel file first.');
      return;
    }
    if (importRowCount !== null && importRowCount > 500) {
      alert(`Limit exceeded: Bulk import is limited to 500 rows. Selected file has ${importRowCount} rows.`);
      return;
    }
    if (!importPassword || importPassword.length < 8) {
      alert('Please specify a default password of at least 8 characters.');
      return;
    }

    setImportLoading(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const response = await apiFetch('/auth/bulk-import', {
          method: 'POST',
          body: JSON.stringify({
            students: json,
            default_password: importPassword
          })
        });

        setImportResult(response);
        setImportFile(null);
        setImportPassword('');
        loadStudentsData(studentsPage, studentsSearch, studentsBranchFilter, studentsPwFilter);
      } catch (err) {
        alert('Failed parsing/uploading Excel data: ' + err.message);
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsArrayBuffer(importFile);
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      { "Student Name": "Amit Kumar", "Roll Number": "23CS001", "Branch": "CSE" },
      { "Student Name": "John Doe", "Roll Number": "23EC015", "Branch": "ECE" },
      { "Student Name": "Sarah Connor", "Roll Number": "23ME044", "Branch": "Mechanical" }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    XLSX.writeFile(workbook, "labscan_student_import_template.xlsx");
  };

  const downloadImportErrorReport = () => {
    if (!importResult) return;
    let content = "=== LabScan Excel Import Error Report ===\n\n";
    content += `Summary:\n`;
    content += `- Total Input Rows: ${importResult.summary.total}\n`;
    content += `- Successfully Imported: ${importResult.summary.importedCount}\n`;
    content += `- Duplicates Rejected: ${importResult.summary.duplicatesCount}\n`;
    content += `- Invalid Rows Skipped: ${importResult.summary.invalidCount}\n\n`;

    if (importResult.duplicates.length > 0) {
      content += "=== Duplicate Roll Numbers ===\n";
      importResult.duplicates.forEach(d => {
        content += `Row ${d.row}: Roll Number "${d.roll_number}" - ${d.error}\n`;
      });
      content += "\n";
    }

    if (importResult.invalidRows.length > 0) {
      content += "=== Invalid or Malformed Rows ===\n";
      importResult.invalidRows.forEach(i => {
        content += `Row ${i.row}: ${i.roll_number ? `Roll "${i.roll_number}" - ` : ''}${i.error}\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "labscan_import_error_report.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const printMarkerWindow = (id, experimentName) => {
    const grid = getArucoGrid(id);
    if (!grid) {
      alert('Invalid ArUco ID.');
      return;
    }

    const totalSize = grid.length;
    const cellSize = 300 / totalSize;

    let svgRects = '';
    grid.forEach((row, r) => {
      row.forEach((val, c) => {
        svgRects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${val === 1 ? 'white' : 'black'}" />`;
      });
    });

    const svgHtml = `
      <svg width="300" height="300" viewBox="0 0 300 300" style="border: 20px solid white; background: white;">
        ${svgRects}
      </svg>
    `;

    const printWindow = window.open('', '_blank', 'width=600,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print ArUco Marker ID ${id}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #fff; color: #000; }
            .marker-container { margin: 30px auto; display: inline-block; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            h1 { margin-bottom: 5px; }
            p { color: #555; margin-top: 5px; }
            @media print { button { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>LabScan ArUco Marker</h1>
          <h2>Experiment: ${experimentName}</h2>
          <p>ArUco ID: <strong>${id}</strong> (Dictionary: MIP_36h12)</p>
          <div class="marker-container">${svgHtml}</div>
          <br/><br/>
          <button onclick="window.print()" style="padding: 12px 24px; font-weight: bold; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Print Marker Sheet</button>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleRailTabClick = (railId) => {
    if (railId === 'dashboard') setActiveTab('labs');
    else if (railId === 'calendar') setActiveTab('experiments');
    else if (railId === 'analytics') setActiveTab('students');
    else if (railId === 'files') setActiveTab('audit');
    else if (railId === 'settings') setActiveTab('settings');
  };

  const activeRailTab = 
    activeTab === 'labs' ? 'dashboard' :
    activeTab === 'experiments' ? 'calendar' :
    activeTab === 'students' ? 'analytics' :
    activeTab === 'audit' ? 'files' :
    'settings';

  const totalRegisteredStudents = studentSummary?.totalStudents || 0;
  const activeRate = totalRegisteredStudents > 0 ? ((studentSummary?.activeStudents || 0) / totalRegisteredStudents) * 100 : 0;

  return (
    <div className="bento-dashboard-wrapper">
      <style>{`
        .bento-dashboard-wrapper {
          min-height: 100vh;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-family: ${font.sans};
          position: relative;
          padding-left: 112px;
          box-sizing: border-box;
        }

        .dashboard-content-layout {
          padding: 40px;
          max-width: 1300px;
          margin: 0 auto;
          position: relative;
          z-index: 10;
        }

        .mobile-nav-header {
          display: none !important;
        }

        .bento-grid-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-top: 30px;
        }

        .bento-card-full {
          grid-column: span 3;
        }
        .bento-card-2col {
          grid-column: span 2;
        }
        .bento-card-1col {
          grid-column: span 1;
        }

        .analytics-bar-chart {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 100px;
          margin-top: 20px;
          padding: 10px 0;
        }
        .analytics-bar {
          width: 24px;
          background: var(--accent-blue);
          border-radius: 4px;
          transition: height 0.6s ease;
          position: relative;
        }
        .analytics-bar-label {
          position: absolute;
          bottom: -22px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          color: var(--text-muted);
          font-weight: 700;
        }

        .bento-list-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        .bento-list-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 13.5px;
          transition: background 0.2s ease;
        }
        .bento-list-row:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .shortcuts-grid-layout {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 16px;
        }
        .shortcut-rounded-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          gap: 8px;
        }
        .shortcut-rounded-tile:hover {
          background: rgba(56, 189, 248, 0.05);
          border-color: var(--accent-blue);
          transform: translateY(-2px);
        }

        .drawer-overlay {
          position: fixed;
          top: 0;
          right: 0;
          width: 440px;
          height: 100vh;
          background-color: var(--bg-secondary);
          border-left: 1px solid var(--border-color);
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .excel-drop-zone {
          border: 2px dashed var(--border-color);
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          cursor: pointer;
          background-color: rgba(255, 255, 255, 0.01);
          transition: all 0.2s ease;
        }
        .excel-drop-zone.active {
          border-color: var(--accent-warning);
          background-color: rgba(245, 158, 11, 0.05);
        }

        .erp-input {
          background-color: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 13.5px;
          width: 100%;
          outline: none;
          box-sizing: border-box;
        }
        .erp-input:focus {
          border-color: var(--accent-blue);
        }

        .branch-check-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 12px;
          margin-top: 6px;
        }

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .admin-action-row {
          display: flex;
          gap: 10px;
        }

        .admin-filter-bar {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .erp-datatable-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          margin-top: 10px;
        }

        .admin-table-actions {
          display: inline-flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .erp-datatable {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .erp-datatable th {
          background-color: rgba(255, 255, 255, 0.01);
          color: var(--text-primary);
          padding: 12px 14px;
          font-weight: 700;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border-color);
          white-space: nowrap;
        }
        .erp-datatable td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border-color);
          font-size: 13px;
          color: var(--text-secondary);
        }
        .erp-datatable tr:hover td {
          background-color: rgba(255, 255, 255, 0.02);
        }

        .show-on-mobile-only {
          display: none;
        }

        .timestamp-cell {
          white-space: nowrap;
        }

        .audit-details-cell {
          color: var(--text-secondary);
          font-size: 11.5px;
          white-space: pre-wrap;
          word-break: break-word;
          display: block;
          max-width: 280px;
        }

        @media (max-width: 1024px) {
          .admin-stats-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
        }

        @media (max-width: 900px) {
          .bento-grid-container {
            grid-template-columns: repeat(2, 1fr);
          }
          .bento-card-full, .bento-card-2col, .bento-card-1col {
            grid-column: span 2;
          }
        }

        @media (max-width: 767px) {
          .bento-dashboard-wrapper {
            padding-left: 0;
            padding-top: 70px;
            padding-bottom: 90px !important;
            overflow-x: hidden !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .dashboard-content-layout {
            padding: 16px;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .bento-grid-container {
            grid-template-columns: 1fr;
            gap: 16px;
            width: 100% !important;
          }
          .bento-card-full, .bento-card-2col, .bento-card-1col {
            grid-column: span 1;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }
          .glass-bento-card {
            padding: 16px !important;
            border-radius: 16px !important;
          }
          .excel-drop-zone {
            padding: 16px 12px !important;
          }
          .admin-stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .admin-action-row {
            flex-direction: column !important;
            gap: 8px !important;
          }
          .admin-action-row > button {
            width: 100% !important;
          }
          .admin-filter-bar {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .admin-filter-bar select, 
          .admin-filter-bar button, 
          .admin-filter-bar > div {
            width: 100% !important;
            min-width: 100% !important;
            box-sizing: border-box !important;
          }
          .drawer-overlay {
            width: 100vw !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
          tr.show-on-mobile-only {
            display: table-row !important;
          }
          span.show-on-mobile-only {
            display: inline-block !important;
          }

          /* Forms layout on mobile */
          form {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
            gap: 12px !important;
          }
          form .erp-input, 
          form select.erp-input, 
          form button {
            width: 100% !important;
            min-width: 100% !important;
            box-sizing: border-box !important;
          }
          form button.password-toggle-btn {
            width: auto !important;
            min-width: auto !important;
          }

          /* Mobile Datatable Responsive Layout Rules */
          .erp-datatable th, .erp-datatable td {
            padding: 10px 8px !important;
            font-size: 12px !important;
          }
          
          /* Students Table Columns */
          .erp-datatable th:nth-child(1),
          .erp-datatable td:nth-child(1) {
            width: 32% !important;
            word-break: break-word !important;
          }
          .erp-datatable th:nth-child(2),
          .erp-datatable td:nth-child(2) {
            width: 23% !important;
            white-space: nowrap !important;
            font-family: var(--font-mono) !important;
          }
          .erp-datatable th:nth-child(3),
          .erp-datatable td:nth-child(3) {
            width: 15% !important;
            white-space: nowrap !important;
          }
          .erp-datatable th:last-child,
          .erp-datatable td:last-child {
            width: 30% !important;
            min-width: 135px !important;
            text-align: right !important;
          }

          /* Audit Logs Table Columns */
          .erp-datatable th:nth-child(1),
          .erp-datatable td:nth-child(1) {
            width: 25% !important;
            min-width: 80px !important;
          }
          .erp-datatable th:nth-child(2),
          .erp-datatable td:nth-child(2) {
            width: 25% !important;
            min-width: 80px !important;
          }
          .erp-datatable th:nth-child(3),
          .erp-datatable td:nth-child(3) {
            width: 20% !important;
            white-space: nowrap !important;
          }
          .erp-datatable th:nth-child(5),
          .erp-datatable td:nth-child(5) {
            width: 30% !important;
            min-width: 100px !important;
          }

          .timestamp-cell {
            white-space: normal !important;
            word-break: break-word !important;
            font-size: 11px !important;
          }

          .audit-details-cell {
            max-width: 100% !important;
          }

          .audit-badge {
            font-size: 9.5px !important;
            padding: 3px 6px !important;
            white-space: nowrap !important;
          }

          /* Compact & Balanced Actions Row Layout on Mobile */
          .admin-table-actions {
            display: flex !important;
            flex-direction: row !important;
            justify-content: flex-end !important;
            flex-wrap: wrap !important;
            gap: 4px !important;
            width: 100% !important;
          }
          .admin-table-actions > button {
            padding: 5px 8px !important;
            font-size: 10px !important;
            margin: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
            border-radius: 4px !important;
            min-height: 24px !important;
          }
        }
      `}</style>

      {/* Ambient background glows */}
      <div className="ambient-glow-canvas">
        <div className="glow-blue" />
        <div className="glow-amber" />
      </div>

      {/* Left Sidebar Rail */}
      <SidebarRail 
        activeItem={activeRailTab} 
        onItemClick={handleRailTabClick} 
        user={user} 
        showHome={false}
        onLogout={handleLogout}
      />

      {/* Student Profile Drawer */}
      {drawerStudentId && (
        <div className="drawer-overlay">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Academic Inspection</h3>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setDrawerStudentId(null)}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {studentDrawerInfo ? (
              <>
                {/* Academic Information */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-warning)', textTransform: 'uppercase', fontFamily: font.mono, marginBottom: '10px' }}>Academic Info</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div>Full Name: <strong>{studentDrawerInfo.profile.full_name}</strong></div>
                    <div>Roll Number: <strong style={{ fontFamily: font.mono }}>{studentDrawerInfo.profile.roll_number}</strong></div>
                    <div>Branch: <strong>{studentDrawerInfo.profile.branch_name}</strong></div>
                    <div>Institution: <strong>{studentDrawerInfo.profile.institution_name || 'St. Jude College'}</strong></div>
                    <div>Enrolled Date: <strong>{new Date(studentDrawerInfo.profile.created_at).toLocaleDateString()}</strong></div>
                  </div>
                </div>

                {/* Account Details */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-warning)', textTransform: 'uppercase', fontFamily: font.mono, marginBottom: '10px' }}>Account Status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div>Password status: <strong>{studentDrawerInfo.profile.force_password_change ? 'Force Reset Pending' : 'Verified (Custom Password)'}</strong></div>
                    <div>Last Sync: <strong>{new Date(studentDrawerInfo.profile.updated_at).toLocaleString()}</strong></div>
                    <div>System ID: <strong style={{ fontFamily: font.mono, fontSize: '11px' }}>{studentDrawerInfo.profile.user_id}</strong></div>
                  </div>
                </div>

                {/* Lab Worksheets progress */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-warning)', textTransform: 'uppercase', fontFamily: font.mono, marginBottom: '10px' }}>Assigned Worksheets</div>
                  {studentDrawerInfo.worksheets.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {studentDrawerInfo.worksheets.map((w, idx) => (
                        <div key={idx} style={{ padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{w.experiment_name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{w.lab_name}</div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                            <span style={{
                              color: w.session_completed_at ? 'var(--success-emerald)' : 'var(--accent-cyan)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              fontSize: '9px'
                            }}>
                              {w.session_completed_at ? 'Completed' : 'In Progress'}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                              {w.session_completed_at ? `Done: ${new Date(w.session_completed_at).toLocaleDateString()}` : `Started: ${new Date(w.session_started_at).toLocaleDateString()}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No worksheets started or registered in active session database for this student.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
                Loading student audit profile...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Top Mobile Header */}
      <div className="mobile-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LabScanLogo size={20} />
          <span style={{ fontSize: '13px', fontFamily: font.mono, color: 'var(--text-muted)', fontWeight: 700 }}>
            {institution?.short_name ? `${institution.short_name} Admin` : 'Admin Console'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ThemeToggle size="sm" />
          <button 
            onClick={handleLogout} 
            className="academic-btn btn-academic-secondary" 
            style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '8px' }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Floating Bottom Mobile Tab Bar */}
      <nav className="mobile-nav-pill">
        <button 
          className={`mobile-nav-pill-item ${activeTab === 'labs' ? 'active' : ''}`}
          onClick={() => setActiveTab('labs')}
        >
          <div className="active-indicator">
            <Grid size={20} />
          </div>
          <span>Workspace</span>
        </button>
        <button 
          className={`mobile-nav-pill-item ${activeTab === 'experiments' ? 'active' : ''}`}
          onClick={() => setActiveTab('experiments')}
        >
          <div className="active-indicator">
            <BookOpen size={20} />
          </div>
          <span>Courses</span>
        </button>
        <button 
          className={`mobile-nav-pill-item ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          <div className="active-indicator">
            <Users size={20} />
          </div>
          <span>Register</span>
        </button>
        <button 
          className={`mobile-nav-pill-item ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <div className="active-indicator">
            <FileText size={20} />
          </div>
          <span>Audits</span>
        </button>
        <button 
          className={`mobile-nav-pill-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <div className="active-indicator">
            <Settings size={20} />
          </div>
          <span>System</span>
        </button>
      </nav>

      {/* Main Grid Area */}
      <main className="dashboard-content-layout">
        
        {loading ? (
          <>
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <Skeleton variant="text" width="240px" height="28px" />
              <Skeleton variant="text" width="180px" height="13px" style={{ marginTop: '6px' }} />
            </div>

            <div className="bento-grid-container">
              {/* Welcome banner skeleton */}
              <div className="bento-card-2col">
                <div className="skeleton-card" style={{ height: '140px' }}>
                  <Skeleton variant="text" width="40%" height="24px" />
                  <Skeleton variant="text" width="60%" height="14px" style={{ marginTop: '8px' }} />
                  <Skeleton variant="text" width="30%" height="14px" style={{ marginTop: '4px' }} />
                </div>
              </div>

              {/* Stats card skeleton */}
              <div className="bento-card-1col">
                <div className="skeleton-card" style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Skeleton variant="circle" width="56px" height="56px" />
                  <Skeleton variant="text" width="60%" height="12px" style={{ marginTop: '8px' }} />
                </div>
              </div>

              {/* Directory list skeleton */}
              <div className="bento-card-2col">
                <div className="skeleton-card" style={{ height: '220px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <Skeleton variant="text" width="120px" height="18px" />
                    <Skeleton variant="text" width="80px" height="18px" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <Skeleton variant="text" width="40%" height="14px" />
                          <Skeleton variant="text" width="25%" height="10px" />
                        </div>
                        <Skeleton variant="text" width="70px" height="32px" style={{ borderRadius: '999px' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Creation form skeleton */}
              <div className="bento-card-1col">
                <div className="skeleton-card" style={{ height: '220px' }}>
                  <Skeleton variant="text" width="100px" height="18px" style={{ marginBottom: '14px' }} />
                  <Skeleton variant="text" width="100%" height="32px" />
                  <Skeleton variant="text" width="100%" height="32px" style={{ marginTop: '8px' }} />
                  <Skeleton variant="text" width="50%" height="32px" style={{ marginTop: '16px', borderRadius: '999px' }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Welcome Section */}
            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Admin ERP Console</h1>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Configure courses, enrollment databases, and logs
              </p>
            </div>

        {error && <div style={{ color: 'var(--accent-red)', marginBottom: '20px', textAlign: 'left' }}>{error}</div>}

        {/* 1. LABORATORIES MANAGEMENT TAB */}
        {activeTab === 'labs' && (
          <div className="bento-grid-container">
            {/* Hero Greeting */}
            <div className="bento-card-2col">
              <GreetingHero name={adminProfile.full_name || user?.username} department="Laboratory Management Controls" />
            </div>

            {/* Circular Progress Ring Card */}
            <div className="bento-card-1col">
              <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <ProgressRing percentage={activeRate} label="Active Student Ratio" />
              </GlassCard>
            </div>

            {/* Creation Form Glass Panel */}
            <div className="bento-card-1col" id="add-lab-section">
              <GlassCard style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{labForm.id ? 'Modify Lab Unit' : 'Register New Lab'}</h3>
                
                <form onSubmit={handleLabSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Lab Name</label>
                    <input 
                      type="text" 
                      className="erp-input"
                      value={labForm.lab_name}
                      onChange={(e) => setLabForm({ ...labForm, lab_name: e.target.value })}
                      placeholder="e.g. Inorganic Chemistry Lab"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Description</label>
                    <textarea 
                      className="erp-input"
                      value={labForm.description}
                      onChange={(e) => setLabForm({ ...labForm, description: e.target.value })}
                      placeholder="Provide overview details..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Room / Building Location</label>
                    <input 
                      type="text" 
                      className="erp-input"
                      value={labForm.location || ''}
                      onChange={(e) => setLabForm({ ...labForm, location: e.target.value })}
                      placeholder="e.g. Block 4, Room 302"
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Applicable Branches</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          onChange={(e) => toggleSelectAllBranches(e.target.checked)}
                          checked={labForm.allowed_branches.length === branches.length && branches.length > 0}
                        />
                        Select All
                      </label>
                    </div>
                    
                    {branches.length > 0 ? (
                      <div className="branch-check-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', padding: '8px' }}>
                        {branches.map(b => (
                          <label key={b.branch_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <input 
                              type="checkbox"
                              checked={labForm.allowed_branches.includes(b.branch_id)}
                              onChange={() => toggleBranchSelection(b.branch_id)}
                            />
                            {b.name}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        No branches configured.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="submit" className="academic-btn btn-academic-primary pill" style={{ flex: 1 }}>
                      {labForm.id ? 'Save' : 'Create'}
                    </button>
                    {labForm.id && (
                      <button type="button" className="academic-btn btn-academic-secondary" onClick={() => setLabForm({ id: null, lab_name: '', description: '', allowed_branches: [] })}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </GlassCard>
            </div>

            {/* Labs list card (2-col span) */}
            <div className="bento-card-2col">
              <GlassCard style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Laboratory Units Directory</h3>
                <div className="bento-list-stack">
                  {labs.map(lab => {
                    const allowedNames = branches
                      .filter(b => lab.allowed_branches?.includes(b.branch_id))
                      .map(b => b.name);

                    return (
                      <div key={lab.lab_id} className="bento-list-row" style={{ display: 'block', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1, marginRight: '16px' }}>
                            <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700 }}>{lab.lab_name}</h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>{lab.description || 'No description provided.'}</p>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: font.mono }}>Access:</span>
                              {allowedNames.length === 0 ? (
                                <span style={{ fontSize: '11px', color: 'var(--accent-red)', fontWeight: 600 }}>Locked (No branch assigned)</span>
                              ) : allowedNames.length === branches.length ? (
                                <span style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600 }}>All Academic Branches</span>
                              ) : (
                                allowedNames.map((name, i) => (
                                  <span key={i} style={{ fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontFamily: font.mono }}>
                                    {name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              className="academic-btn btn-academic-secondary" 
                              style={{ padding: '6px' }}
                              title="Edit"
                              onClick={() => setLabForm({ 
                                id: lab.lab_id, 
                                lab_name: lab.lab_name, 
                                description: lab.description,
                                allowed_branches: lab.allowed_branches || []
                              })}
                            >
                              <Edit size={13} />
                            </button>
                            <button 
                              className="academic-btn btn-academic-secondary" 
                              style={{ padding: '6px', color: 'var(--accent-red)' }} 
                              title="Delete"
                              onClick={() => handleLabDelete(lab.lab_id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {labs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No laboratory courses registered yet.</p>}
                </div>
              </GlassCard>
            </div>

          </div>
        )}

        {/* 2. EXPERIMENTS TAB */}
        {activeTab === 'experiments' && (
          <div className="bento-grid-container">
            {/* Form card */}
            <div className="bento-card-1col" id="add-exp-section">
              <GlassCard style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{expForm.id ? 'Modify Experiment' : 'Add Experiment'}</h3>
                
                <form onSubmit={handleExpSubmit} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {!expForm.id && (
                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Laboratory Course</label>
                      <select 
                        className="erp-input"
                        value={expForm.lab_id}
                        onChange={(e) => setExpForm({ ...expForm, lab_id: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Lab Unit --</option>
                        {labs.map(lab => (
                          <option key={lab.lab_id} value={lab.lab_id}>{lab.lab_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Experiment Name</label>
                    <input 
                      type="text" 
                      className="erp-input"
                      value={expForm.experiment_name}
                      onChange={(e) => setExpForm({ ...expForm, experiment_name: e.target.value })}
                      placeholder="e.g. Pendulum Gravity analysis"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>ArUco Marker ID (0-99)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="99"
                      className="erp-input"
                      value={expForm.ar_qr_marker_id}
                      onChange={(e) => setExpForm({ ...expForm, ar_qr_marker_id: e.target.value })}
                      placeholder="e.g. 2"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Short Description</label>
                    <textarea 
                      className="erp-input"
                      value={expForm.description}
                      onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                      placeholder="Provide short explanation..."
                      rows={2}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="submit" className="academic-btn btn-academic-primary pill" style={{ flex: 1 }}>
                      {expForm.id ? 'Save' : 'Create'}
                    </button>
                    {expForm.id && (
                      <button type="button" className="academic-btn btn-academic-secondary" onClick={() => setExpForm({ id: null, lab_id: '', experiment_name: '', description: '', ar_qr_marker_id: '' })}>
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </GlassCard>
            </div>

            {/* List card (2-col span) */}
            <div className="bento-card-2col">
              <GlassCard style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Experiments Registry</h3>
                <div className="bento-list-stack">
                  {experiments.map(exp => (
                    <div key={exp.experiment_id} className="bento-list-row" style={{ display: 'block', padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <ArucoMarker id={exp.ar_qr_marker_id} size={64} />
                          <button 
                            type="button"
                            className="academic-btn btn-academic-secondary" 
                            style={{ padding: '2px 6px', fontSize: '9.5px' }}
                            onClick={() => printMarkerWindow(exp.ar_qr_marker_id, exp.experiment_name)}
                          >
                            Print Marker
                          </button>
                        </div>

                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--accent-warning)', fontWeight: 700, textTransform: 'uppercase', fontFamily: font.mono }}>
                            {exp.lab_name} (Ver. {exp.latest_version || 1})
                          </span>
                          <h4 style={{ margin: '2px 0 4px', fontSize: '15px', fontWeight: 700 }}>{exp.experiment_name}</h4>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>{exp.description}</p>
                          
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button 
                              className="academic-btn btn-academic-primary" 
                              style={{ padding: '4px 10px', fontSize: '11.5px' }}
                              onClick={() => navigate(`/admin/editor/${exp.experiment_id}`)}
                            >
                              Content Editor
                            </button>
                            <button 
                              className="academic-btn btn-academic-secondary" 
                              style={{ padding: '4px 10px', fontSize: '11.5px' }}
                              onClick={() => setExpForm({
                                id: exp.experiment_id,
                                lab_id: exp.lab_id,
                                experiment_name: exp.experiment_name,
                                description: exp.description,
                                ar_qr_marker_id: exp.ar_qr_marker_id
                              })}
                            >
                              Edit Meta
                            </button>
                            <button 
                              className="academic-btn btn-academic-secondary" 
                              style={{ padding: '4px', color: 'var(--accent-red)' }} 
                              onClick={() => handleExpDelete(exp.experiment_id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {experiments.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No experiments added yet.</p>}
                </div>
              </GlassCard>
            </div>

          </div>
        )}

        {/* 3. STUDENTS ERP MANAGEMENT TAB */}
        {activeTab === 'students' && (
          <div style={{ textAlign: 'left' }}>
            
            {/* Student Stats HUD */}
            <div className="admin-stats-grid">
              <GlassCard style={{ padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: font.mono }}>{studentSummary.totalStudents}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>Total Students</div>
              </GlassCard>
              <GlassCard style={{ padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: font.mono }}>{studentSummary.totalBranches}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>Total Branches</div>
              </GlassCard>
              <GlassCard style={{ padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: font.mono }}>{studentSummary.activeStudents}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>Active Accounts</div>
              </GlassCard>
              <GlassCard style={{ padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: font.mono }}>{studentSummary.importedToday}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>Imported Today</div>
              </GlassCard>
              <GlassCard style={{ padding: '16px' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: font.mono }}>{studentSummary.pendingPasswordChange}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>Pending Resets</div>
              </GlassCard>
            </div>

            <div className="bento-grid-container" style={{ alignItems: 'start' }}>
              {/* Bulk Excel Ingestion */}
              <div className="bento-card-2col">
                <GlassCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                    <Upload size={18} style={{ color: 'var(--accent-blue)' }} />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Bulk Student Ingestion</h3>
                  </div>

                  <div 
                    className={`excel-drop-zone ${dragActive ? 'active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  >
                    <FileText size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {importFile ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '6px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            Selected: {importFile.name} {importRowCount !== null ? `— ${importRowCount} rows detected` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setImportFile(null);
                              setImportResult(null);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-red)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: 0
                            }}
                            title="Clear file"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : null}
                      <div>
                        Drag & drop your Excel (.xlsx) sheet here, or{' '}
                        <label style={{ color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}>
                          Browse files
                          <input 
                            key={importFile ? importFile.name : 'empty'}
                            type="file" 
                            accept=".xlsx" 
                            style={{ display: 'none' }} 
                            onChange={handleFileChange} 
                            onClick={(e) => { e.target.value = null; }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0, lineHeight: '1.4' }}>
                    For best performance, keep bulk imports to 200–300 students per sheet. Larger sheets may take longer or time out. Max 500 rows.
                  </p>

                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px' }}>Default Intake Password</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                          type={showImportPassword ? 'text' : 'password'}
                          className="erp-input"
                          style={{ paddingRight: '40px' }}
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          placeholder="At least 6 characters"
                        />
                        <button 
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowImportPassword(!showImportPassword)}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          {showImportPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="admin-action-row">
                      <button 
                        className="academic-btn btn-academic-primary" 
                        style={{ flex: 1 }}
                        onClick={handleExcelImport}
                        disabled={importLoading || !importFile}
                      >
                        {importLoading ? 'Processing Ingestion...' : 'Import Students'}
                      </button>
                      <button className="academic-btn btn-academic-secondary" onClick={downloadSampleTemplate}>
                        <Download size={14} /> Template
                      </button>
                    </div>
                  </div>

                  {importResult && (
                    <div style={{ marginTop: '14px', padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>Import Summary</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', color: 'var(--text-secondary)' }}>
                        <div>Total Records: {importResult.summary.total}</div>
                        <div>Successful: {importResult.summary.importedCount}</div>
                        <div>Duplicates: {importResult.summary.duplicatesCount}</div>
                        <div>Invalid: {importResult.summary.invalidCount}</div>
                      </div>
                      {(importResult.duplicates.length > 0 || importResult.invalidRows.length > 0) && (
                        <button 
                          className="academic-btn btn-academic-secondary" 
                          style={{ marginTop: '8px', width: '100%', fontSize: '10.5px', padding: '5px' }}
                          onClick={downloadImportErrorReport}
                        >
                          Download Error Report
                        </button>
                      )}
                    </div>
                  )}
                </GlassCard>
              </div>

              {/* Individual manual registration */}
              <div className="bento-card-1col" id="add-student-section">
                <GlassCard>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                    <Plus size={18} style={{ color: 'var(--accent-blue)' }} />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Individual Ingest</h3>
                  </div>

                  <form onSubmit={handleStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input 
                      type="text"
                      className="erp-input"
                      value={studentForm.full_name}
                      onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                      placeholder="Student Full Name"
                      required
                    />
                    <input 
                      type="text"
                      className="erp-input"
                      value={studentForm.roll_number}
                      onChange={(e) => setStudentForm({ ...studentForm, roll_number: e.target.value })}
                      placeholder="Roll Number (e.g. 23CS007)"
                      required
                    />
                    <select
                      className="erp-input"
                      value={studentForm.branch_id}
                      onChange={(e) => setStudentForm({ ...studentForm, branch_id: e.target.value })}
                      required
                    >
                      <option value="">-- Academic Branch --</option>
                      {branches.map(b => (
                        <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                      ))}
                    </select>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showCreateStudentPassword ? 'text' : 'password'}
                        className="erp-input"
                        style={{ paddingRight: '40px' }}
                        value={studentForm.password}
                        onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                        placeholder="Specify Intake Password"
                        required
                      />
                      <button 
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowCreateStudentPassword(!showCreateStudentPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        {showCreateStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button type="submit" className="academic-btn btn-academic-primary pill" style={{ width: '100%', marginTop: '4px' }}>
                      Register Student
                    </button>
                  </form>
                </GlassCard>
              </div>

              {/* Data Table and Filters */}
              <div className="bento-card-full">
                <GlassCard>
                  <div className="admin-filter-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', flex: 1, minWidth: '240px' }}>
                      <Search size={15} style={{ color: 'var(--text-muted)' }} />
                      <input 
                        type="text"
                        value={studentsSearch}
                        onChange={(e) => { setStudentsSearch(e.target.value); setStudentsPage(1); }}
                        placeholder="Search by student name or roll number..."
                        style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '13px' }}
                      />
                    </div>

                    <select 
                      className="erp-input"
                      style={{ width: '160px' }}
                      value={studentsBranchFilter}
                      onChange={(e) => { setStudentsBranchFilter(e.target.value); setStudentsPage(1); }}
                    >
                      <option value="">-- All Branches --</option>
                      {branches.map(b => (
                        <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                      ))}
                    </select>

                    <select 
                      className="erp-input"
                      style={{ width: '180px' }}
                      value={studentsPwFilter}
                      onChange={(e) => { setStudentsPwFilter(e.target.value); setStudentsPage(1); }}
                    >
                      <option value="">-- Password Status --</option>
                      <option value="false">Custom Password Set</option>
                      <option value="true">Force Reset Pending</option>
                    </select>

                    <button 
                      className="academic-btn btn-academic-secondary"
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                      onClick={() => { setStudentsSearch(''); setStudentsBranchFilter(''); setStudentsPwFilter(''); setStudentsPage(1); }}
                    >
                      Clear
                    </button>
                  </div>

                  {/* Inline edit forms */}
                  {editStudentForm && (
                    <div style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '12px', marginBottom: '14px', textAlign: 'left' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Edit Student Account: {editStudentForm.roll_number}</h4>
                      <form onSubmit={handleEditStudentSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
                        <input 
                          type="text"
                          className="erp-input"
                          style={{ width: '200px' }}
                          value={editStudentForm.full_name}
                          onChange={(e) => setEditStudentForm({ ...editStudentForm, full_name: e.target.value })}
                          required
                        />
                        <select
                          className="erp-input"
                          style={{ width: '150px' }}
                          value={editStudentForm.branch_id}
                          onChange={(e) => setEditStudentForm({ ...editStudentForm, branch_id: e.target.value })}
                          required
                        >
                          {branches.map(b => (
                            <option key={b.branch_id} value={b.branch_id}>{b.name}</option>
                          ))}
                        </select>
                        <button type="submit" className="academic-btn btn-academic-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Save</button>
                        <button type="button" className="academic-btn btn-academic-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditStudentForm(null)}>Cancel</button>
                      </form>
                    </div>
                  )}

                  {resetPwForm && (
                    <div style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '12px', marginBottom: '14px', textAlign: 'left' }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Reset Student Password: {resetPwForm.roll_number}</h4>
                      <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input 
                            type={showResetStudentPassword ? 'text' : 'password'}
                            className="erp-input"
                            style={{ width: '240px', paddingRight: '40px' }}
                            value={resetPwForm.password}
                            onChange={(e) => setResetPwForm({ ...resetPwForm, password: e.target.value })}
                            placeholder="Specify New Password"
                            required
                          />
                          <button 
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowResetStudentPassword(!showResetStudentPassword)}
                            style={{
                              position: 'absolute',
                              right: '12px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0
                            }}
                          >
                            {showResetStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <button type="submit" className="academic-btn btn-academic-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Reset & Force flag</button>
                        <button type="button" className="academic-btn btn-academic-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setResetPwForm(null)}>Cancel</button>
                      </form>
                    </div>
                  )}

                  {/* Data Table */}
                  <div className="erp-datatable-wrapper">
                    <table className="erp-datatable">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Roll Number</th>
                          <th>Branch</th>
                          <th className="hide-on-mobile">Password Status</th>
                          <th className="hide-on-mobile">Enrolled Date</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(st => (
                          <React.Fragment key={st.user_id}>
                            <tr 
                              onClick={() => setExpandedStudentId(expandedStudentId === st.user_id ? null : st.user_id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '10px' }} className="show-on-mobile-only">
                                    {expandedStudentId === st.user_id ? '▼' : '▶'}
                                  </span>
                                  <strong>{st.full_name}</strong>
                                </div>
                              </td>
                              <td style={{ fontFamily: font.mono }}>{st.roll_number}</td>
                              <td>{st.branch_name || 'N/A'}</td>
                              <td className="hide-on-mobile">
                                <StatusPill status={st.force_password_change ? 'Force Reset Pending' : 'Custom Password Set'} />
                              </td>
                              <td className="hide-on-mobile">{new Date(st.created_at).toLocaleDateString()}</td>
                              <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                <div className="admin-table-actions">
                                  <button 
                                    className="academic-btn btn-academic-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => handleViewStudentDrawer(st.user_id)}
                                  >
                                    View
                                  </button>
                                  <button 
                                    className="academic-btn btn-academic-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => setEditStudentForm({
                                      user_id: st.user_id,
                                      roll_number: st.roll_number,
                                      full_name: st.full_name,
                                      branch_id: st.branch_id
                                    })}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    className="academic-btn btn-academic-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => setResetPwForm({
                                      user_id: st.user_id,
                                      roll_number: st.roll_number,
                                      password: ''
                                    })}
                                  >
                                    Reset PW
                                  </button>
                                  <button 
                                    className="academic-btn btn-academic-secondary" 
                                    style={{ padding: '4px', color: 'var(--accent-red)' }}
                                    onClick={() => handleStudentDelete(st.user_id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedStudentId === st.user_id && (
                              <tr className="show-on-mobile-only" style={{ background: 'rgba(255,255,255,0.01)' }}>
                                <td colSpan={6} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>Status:</strong> {st.force_password_change ? 'Force Reset Pending' : 'Custom Password Set'}</div>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>Enrolled:</strong> {new Date(st.created_at).toLocaleDateString()}</div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {students.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No student records found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {studentPagination.totalPages > 1 && (
                    <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        Page {studentPagination.page} of {studentPagination.totalPages}
                      </span>
                      <button 
                        className="academic-btn btn-academic-secondary" 
                        style={{ padding: '4px 8px' }}
                        onClick={() => setStudentsPage(Math.max(1, studentsPage - 1))}
                        disabled={studentsPage === 1}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button 
                        className="academic-btn btn-academic-secondary" 
                        style={{ padding: '4px 8px' }}
                        onClick={() => setStudentsPage(Math.min(studentPagination.totalPages, studentsPage + 1))}
                        disabled={studentsPage === studentPagination.totalPages}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </GlassCard>
              </div>

            </div>
          </div>
        )}

        {/* 4. SETTINGS & INSTITUTIONS TAB */}
        {activeTab === 'settings' && (
          <div className="bento-grid-container" style={{ textAlign: 'left' }}>
            <div className="bento-card-2col">
              <GlassCard>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', color: 'var(--accent-blue)' }}>
                  <Landmark size={18} />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Institution & Profile Settings</h3>
                </div>

                <form onSubmit={handleAdminProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Institution Full Name</label>
                    <input 
                      type="text"
                      className="erp-input"
                      value={institution.name}
                      onChange={(e) => setInstitution({ ...institution, name: e.target.value })}
                      placeholder="e.g. St. Jude Engineering College"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Institution Acronym</label>
                    <input 
                      type="text"
                      className="erp-input"
                      value={institution.short_name}
                      onChange={(e) => setInstitution({ ...institution, short_name: e.target.value })}
                      placeholder="e.g. SJU"
                    />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '12px' }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Admin Username (Login ID)</label>
                    <input 
                      type="text"
                      className="erp-input"
                      value={adminProfile.username}
                      onChange={(e) => setAdminProfile({ ...adminProfile, username: e.target.value })}
                      placeholder="e.g. admin"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Operator Full Name</label>
                    <input 
                      type="text"
                      className="erp-input"
                      value={adminProfile.full_name}
                      onChange={(e) => setAdminProfile({ ...adminProfile, full_name: e.target.value })}
                      placeholder="e.g. Dr. Ramesh Rao"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Change Admin Password (Optional)</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showAdminPassword ? 'text' : 'password'}
                        className="erp-input"
                        style={{ paddingRight: '40px' }}
                        value={adminProfile.password}
                        onChange={(e) => setAdminProfile({ ...adminProfile, password: e.target.value })}
                        placeholder="Leave empty to keep current password"
                      />
                      <button 
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="academic-btn btn-academic-primary pill" style={{ width: 'fit-content', marginTop: '6px' }}>
                    Save Global Settings
                  </button>
                </form>
              </GlassCard>
            </div>

            {/* Centralized Branch Management */}
            <div className="bento-card-1col" id="add-branch-section">
              <GlassCard>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', color: 'var(--accent-blue)' }}>
                  <Layers size={18} />
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Academic Branches</h3>
                </div>

                <form onSubmit={handleBranchAdd} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <input 
                    type="text"
                    className="erp-input"
                    value={branchFormName}
                    onChange={(e) => setBranchFormName(e.target.value)}
                    placeholder="e.g. IT"
                    required
                  />
                  <button type="submit" className="academic-btn btn-academic-primary pill" style={{ flexShrink: 0, padding: '8px 12px' }}>
                    Add
                  </button>
                </form>

                {editBranchId && (
                  <form onSubmit={handleBranchUpdate} style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', padding: '10px', display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <input 
                      type="text"
                      className="erp-input"
                      value={editBranchName}
                      onChange={(e) => setEditBranchName(e.target.value)}
                      required
                    />
                    <button type="submit" className="academic-btn btn-academic-primary pill" style={{ padding: '6px' }}>Save</button>
                    <button type="button" className="academic-btn btn-academic-secondary" style={{ padding: '6px' }} onClick={() => setEditBranchId(null)}>Cancel</button>
                  </form>
                )}

                <div className="bento-list-stack" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {branches.map(b => (
                    <div key={b.branch_id} className="bento-list-row" style={{ padding: '8px 12px' }}>
                      <strong>{b.name}</strong>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="academic-btn btn-academic-secondary" style={{ padding: '4px 6px', fontSize: '10px' }} onClick={() => { setEditBranchId(b.branch_id); setEditBranchName(b.name); }}>Edit</button>
                        <button className="academic-btn btn-academic-secondary" style={{ padding: '4px 6px', fontSize: '10px', color: 'var(--accent-red)' }} onClick={() => handleBranchDelete(b.branch_id)}>Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* 5. AUDIT LOGS TAB */}
        {activeTab === 'audit' && (
          <div className="bento-grid-container" style={{ textAlign: 'left' }}>
            <div className="bento-card-full">
              <GlassCard>
                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>System Audit Logs (Append-Only)</h3>
                <div className="erp-datatable-wrapper">
                  <table className="erp-datatable" style={{ fontSize: '12.5px' }}>
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th className="hide-on-mobile">Target</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => {
                        let badgeClass = 'audit-badge-update';
                        if (log.action_type.startsWith('CREATE')) badgeClass = 'audit-badge-create';
                        else if (log.action_type.startsWith('DELETE')) badgeClass = 'audit-badge-delete';
                        else if (log.action_type.includes('LOGIN')) badgeClass = 'audit-badge-login';

                        return (
                          <React.Fragment key={log.log_id}>
                            <tr 
                              onClick={() => setExpandedLogId(expandedLogId === log.log_id ? null : log.log_id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="timestamp-cell">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '10px' }} className="show-on-mobile-only">
                                    {expandedLogId === log.log_id ? '▼' : '▶'}
                                  </span>
                                  {new Date(log.timestamp).toLocaleString()}
                                </div>
                              </td>
                              <td>
                                <span className={`audit-badge ${badgeClass}`}>{log.action_type.replace(/_/g, ' ')}</span>
                              </td>
                              <td><strong>{log.actor_username || 'SYSTEM'}</strong></td>
                              <td className="hide-on-mobile">{log.target_type || '-'}</td>
                              <td>
                                <span className="audit-details-cell">
                                  {formatAuditDetails(log.details)}
                                </span>
                              </td>
                            </tr>
                            {expandedLogId === log.log_id && (
                              <tr className="show-on-mobile-only" style={{ background: 'rgba(255,255,255,0.01)' }}>
                                <td colSpan={5} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                    <div>
                                      <strong style={{ color: 'var(--text-muted)' }}>Target:</strong> {log.target_type || '-'} {log.target_id ? `(${log.target_id})` : ''}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Floating Speed Dial FAB */}
      {!isInputFocused && (
        <div className={`speed-dial-wrapper ${isSpeedDialOpen ? 'open' : ''}`}>
          <button 
            className="btn-fab" 
            onClick={() => setIsSpeedDialOpen(!isSpeedDialOpen)}
            title="Add new item"
          >
            <Plus size={24} style={{ transform: isSpeedDialOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
          </button>
          <div className="speed-dial-actions">
            <div className="speed-dial-item-container">
              <span className="speed-dial-label">Add Lab Unit</span>
              <button 
                className="speed-dial-item"
                onClick={() => {
                  setActiveTab('labs');
                  setTimeout(() => scrollToSection('add-lab-section'), 100);
                }}
              >
                <Landmark size={18} />
              </button>
            </div>
            <div className="speed-dial-item-container">
              <span className="speed-dial-label">Add Experiment</span>
              <button 
                className="speed-dial-item"
                onClick={() => {
                  setActiveTab('experiments');
                  setTimeout(() => scrollToSection('add-exp-section'), 100);
                }}
              >
                <BookOpen size={18} />
              </button>
            </div>
            <div className="speed-dial-item-container">
              <span className="speed-dial-label">Add Student</span>
              <button 
                className="speed-dial-item"
                onClick={() => {
                  setActiveTab('students');
                  setTimeout(() => scrollToSection('add-student-section'), 100);
                }}
              >
                <Users size={18} />
              </button>
            </div>
            <div className="speed-dial-item-container">
              <span className="speed-dial-label">Add Branch</span>
              <button 
                className="speed-dial-item"
                onClick={() => {
                  setActiveTab('students');
                  setTimeout(() => scrollToSection('add-branch-section'), 100);
                }}
              >
                <Layers size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArucoMarker({ id, size = 60 }) {
  try {
    const grid = getArucoGrid(id);
    if (!grid) return <span style={{ color: 'red', fontSize: '0.8rem' }}>Invalid ID</span>;

    const totalSize = grid.length;
    const cellSize = size / totalSize;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ border: '2px solid white', background: 'white', display: 'inline-block' }}>
        {grid.map((row, r) => 
          row.map((val, c) => (
            <rect 
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={val === 1 ? 'white' : 'black'}
            />
          ))
        )}
      </svg>
    );
  } catch (e) {
    return <span style={{ color: 'red', fontSize: '0.8rem' }}>Error</span>;
  }
}
