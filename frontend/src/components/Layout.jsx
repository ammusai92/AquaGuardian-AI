import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { pendingCount, flushQueue } from '../api';
import { isPushEnabled, enablePush } from '../push';

const NAV = [
  ['Overview', [['/', 'Dashboard', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']]]],
  ['Data Collection', [
    ['/quick', 'Quick Field Entry', ['ADMIN', 'RESEARCHER', 'FARMER']],
    ['/measurements', 'Pond Measurements', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']],
    ['/activity', 'Activity & Observations', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']],
    ['/activity-signals', 'Activity Signal', ['ADMIN', 'RESEARCHER', 'VIEWER']],
    ['/feeding', 'Feeding Records', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']],
    ['/feeding-trays', 'Feeding Trays', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']],
    ['/environmental', 'Environmental', ['ADMIN', 'RESEARCHER', 'VIEWER']],
    ['/health', 'Health Observations', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']],
    ['/daily-logs', 'Daily Pond Log', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']],
  ]],
  ['Research', [
    ['/experiments', 'Experiments', ['ADMIN', 'RESEARCHER', 'VIEWER']],
    ['/labels', 'ML Dataset & Labels', ['ADMIN', 'RESEARCHER']],
    ['/ai', 'AI Decisions', ['ADMIN', 'RESEARCHER', 'VIEWER']],
    ['/analytics', 'Research Analytics', ['ADMIN', 'RESEARCHER', 'VIEWER']],
  ]],
  ['Field Work', [
    ['/visits', 'Field Visits', ['ADMIN', 'RESEARCHER', 'VIEWER']],
    ['/feedback', 'Farmer Feedback', ['ADMIN', 'RESEARCHER', 'VIEWER']],
  ]],
  ['Setup', [
    ['/ponds', 'Ponds', ['ADMIN', 'RESEARCHER', 'VIEWER']],
    ['/admin', 'Admin', ['ADMIN', 'RESEARCHER', 'FARMER', 'VIEWER']],
  ]],
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(pendingCount());
  const [pushOn, setPushOn] = useState(false);
  useEffect(() => {
    const h = () => setPending(pendingCount());
    window.addEventListener('ag-sync', h);
    flushQueue();
    const t = setInterval(h, 5000);
    isPushEnabled().then(setPushOn).catch(() => {});
    return () => { window.removeEventListener('ag-sync', h); clearInterval(t); };
  }, []);

  const togglePush = async () => {
    try {
      if (pushOn) { alert('Pond alerts are already enabled on this device.'); return; }
      await enablePush();
      setPushOn(true);
      alert('🔔 Done! Pond safety alerts will now pop up on this device.');
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="app">
      <nav className="side">
        <h1>AquaGuardian AI</h1>
        {NAV.map(([group, items]) => (
          <div key={group}>
            <div className="grp">{group}</div>
            {items.filter(([, , roles]) => roles.includes(user.role)).map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
            ))}
          </div>
        ))}
      </nav>
      <main className="main">
        <div className="topbar">
          <div className="row">
            <button className={`btn ${pushOn ? '' : 'ghost'} small`} onClick={togglePush}>
              {pushOn ? '🔔 Alerts ON' : '🔔 Enable alerts'}
            </button>
            <span className={`sync ${pending ? 'pending' : 'synced'}`}>
              {pending ? `PENDING SYNC: ${pending}` : 'ALL SYNCED'}
            </span>
          </div>
          <div className="row">
            <span className="muted">{user.name} · {user.role}</span>
            <button className="btn ghost small" onClick={logout}>Logout</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}