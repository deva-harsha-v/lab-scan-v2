import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './utils/api';

const Landing = lazy(() => import('./pages/Landing'));
const ScanSimulator = lazy(() => import('./pages/ScanSimulator'));
const Login = lazy(() => import('./pages/Login'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminEditor = lazy(() => import('./pages/AdminEditor'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const ExperimentWorkspace = lazy(() => import('./pages/ExperimentWorkspace'));

// Route Guards
function RequireAuth({ children, allowedRoles }) {
  const user = getUser();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return user.role === 'admin' 
      ? <Navigate to="/admin/dashboard" replace /> 
      : <Navigate to="/student/dashboard" replace />;
  }

  return children;
}

const LoadingFallback = () => (
  <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#8b9bb4', fontFamily: 'sans-serif' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>LabScan</div>
      <div style={{ fontSize: '12px', opacity: 0.6 }}>Loading workspace module...</div>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Unauthenticated Entrance Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/scan-simulator" element={<ScanSimulator />} />
          
          {/* Authentication portals */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Student Portal Protected Routes */}
          <Route 
            path="/student/dashboard" 
            element={
              <RequireAuth allowedRoles={['student']}>
                <StudentDashboard />
              </RequireAuth>
            } 
          />

          {/* Admin Portal Protected Routes */}
          <Route 
            path="/admin/dashboard" 
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AdminDashboard />
              </RequireAuth>
            } 
          />
          <Route 
            path="/admin/editor/:experimentId" 
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AdminEditor />
              </RequireAuth>
            } 
          />

          {/* Experiment Workspace (Accessible by logged in student OR guest in Ghost Mode) */}
          <Route path="/experiment/:experimentId" element={<ExperimentWorkspace />} />

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
