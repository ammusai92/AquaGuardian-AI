import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import QuickEntry from './pages/QuickEntry';
import ResourcePage from './pages/ResourcePage';
import SignalsPage from './pages/SignalsPage';
import MlLabels from './pages/MlLabels';
import AiPage from './pages/AiPage';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import { RESOURCES } from './config/forms';

export default function App() {
  const { authed } = useAuth();
  if (!authed) return <Login />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/quick" element={<QuickEntry />} />
        <Route path="/activity-signals" element={<SignalsPage />} />
        <Route path="/labels" element={<MlLabels />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/admin" element={<Admin />} />
        {Object.keys(RESOURCES).map((k) => (
          <Route key={k} path={`/${k}`} element={<ResourcePage name={k} />} />
        ))}
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
}