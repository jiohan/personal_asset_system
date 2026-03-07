import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout } from '../api';
import { useState } from 'react';

export default function Layout() {
    const { me, setMe } = useAuth();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    async function onLogout() {
        setSubmitting(true);
        try {
            await logout();
            setMe(null);
            navigate('/auth', { replace: true });
        } catch (err) {
            console.error(err);
            setMe(null);
            navigate('/auth', { replace: true });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="layout-container">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h2>ASSET SYSTEM</h2>
                </div>
                <nav className="sidebar-nav">
                    <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/transactions" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Transactions
                    </NavLink>
                    <NavLink to="/accounts" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Accounts
                    </NavLink>
                    <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Categories
                    </NavLink>

                    <div className="sidebar-divider" />

                    <NavLink to="/transfers" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Transfers <span className="badge">Soon</span>
                    </NavLink>
                    <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Reports <span className="badge">Soon</span>
                    </NavLink>
                    <NavLink to="/imports" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Imports <span className="badge">Soon</span>
                    </NavLink>
                    <NavLink to="/backups" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Backups <span className="badge">Soon</span>
                    </NavLink>
                </nav>
            </aside>
            <div className="main-content-wrapper">
                <header className="topbar">
                    <div className="topbar-left">
                        {/* Page specific title injected by children or context if needed */}
                    </div>
                    <div className="topbar-right">
                        <span className="user-email">{me?.email}</span>
                        <button className="btn-logout" onClick={onLogout} disabled={submitting}>Logout</button>
                    </div>
                </header>
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
