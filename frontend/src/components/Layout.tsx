import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isApiError, logout } from '../api';
import { useState } from 'react';

export default function Layout() {
    const { me, setMe } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const inTransferWorkspace = location.pathname === '/transactions'
        && new URLSearchParams(location.search).get('type') === 'TRANSFER';

    async function onLogout() {
        setSubmitting(true);
        setLogoutError('');
        try {
            await logout();
            setMe(null);
            navigate('/auth', { replace: true });
        } catch (err) {
            console.error(err);
            if (isApiError(err) && err.status !== 401) {
                setLogoutError(err.message);
            }
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
                    <NavLink to="/transactions" className={({ isActive }) => (isActive && !inTransferWorkspace) ? 'nav-item active' : 'nav-item'}>
                        Transactions
                    </NavLink>
                    <NavLink to="/accounts" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Accounts
                    </NavLink>
                    <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Categories
                    </NavLink>

                    <div className="sidebar-divider" />

                    <NavLink to="/transfers" className={() => inTransferWorkspace ? 'nav-item active' : 'nav-item'}>
                        Transfers
                    </NavLink>
                    <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        Reports
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
                        {logoutError ? <span className="hint error">{logoutError}</span> : null}
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
