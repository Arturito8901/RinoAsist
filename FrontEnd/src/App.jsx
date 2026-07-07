import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './views/Welcome';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import ScanAttendance from './views/ScanAttendance';
import ResetPassword from './views/ResetPassword';
import Register from './views/Register';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Welcome Page */}
        <Route path="/" element={<Welcome />} />

        {/* Login Page */}
        <Route path="/login" element={<Login />} />

        {/* Register/Invite Completion Page */}
        <Route path="/register" element={<Register />} />

        {/* Dashboard Page */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Scan Attendance Page */}
        <Route path="/scan" element={<ScanAttendance />} />

        {/* Reset Password Page */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

