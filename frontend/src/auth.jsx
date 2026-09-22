import React, { createContext, useContext, useState } from 'react';
import { api, setToken, getToken } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ag_user')); } catch { return null; }
  });

  const login = async (email, password) => {
    const d = await api.post('/api/auth/login', { email, password });
    setToken(d.token);
    localStorage.setItem('ag_user', JSON.stringify(d.user));
    setUser(d.user);
  };
  const logout = () => {
    setToken('');
    localStorage.removeItem('ag_user');
    setUser(null);
  };
  const authed = !!user && !!getToken();
  return <Ctx.Provider value={{ user, login, logout, authed }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);