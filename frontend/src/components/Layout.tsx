import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isApiError, logout } from '../api';
import { useEffect, useState } from 'react';

type NavItem = {
    to: string;
    label: string;
    group: 'Operations' | 'Library';
};

const NAV_ITEMS: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', group: 'Operations' },
    { to: '/transactions', label: 'Transactions', group: 'Operations' },
    { to: '/imports', label: 'Imports', group: 'Operations' },
    { to: '/accounts', label: 'Accounts', group: 'Library' },
    { to: '/categories', label: 'Categories', group: 'Library' },
    { to: '/reports', label: 'Reports', group: 'Library' },
    { to: '/backups', label: 'Backups', group: 'Library' }
];

function currentPageMeta(pathname: string, search: string) {
    const params = new URLSearchParams(search);
    if (pathname === '/dashboard') return { title: 'Control Center', eyebrow: 'Operations' };
    if (pathname === '/transactions') {
        return params.get('type') === 'TRANSFER'
            ? { title: 'Transfers', eyebrow: 'Operations' }
            : { title: 'Transactions', eyebrow: 'Operations' };
    }
    if (pathname === '/imports') return { title: 'Import Studio', eyebrow: 'Operations' };
    if (pathname === '/accounts') return { title: 'Accounts', eyebrow: 'Library' };
    if (pathname === '/categories') return { title: 'Categories', eyebrow: 'Library' };
    if (pathname === '/reports') return { title: 'Reports', eyebrow: 'Library' };
    if (pathname === '/backups') return { title: 'Backups', eyebrow: 'Library' };
    return { title: 'Asset System', eyebrow: 'Workspace' };
}

export default function Layout() {
    const { me, setMe } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [navOpen, setNavOpen] = useState(false);
    const [railCollapsed, setRailCollapsed] = useState(false);
    const inTransferWorkspace = location.pathname === '/transactions'
        && new URLSearchParams(location.search).get('type') === 'TRANSFER';
    const pageMeta = currentPageMeta(location.pathname, location.search);

    useEffect(() => {
        setNavOpen(false);
    }, [location.pathname, location.search]);

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
        <div className={`layout-container ${railCollapsed ? 'rail-collapsed' : ''} ${navOpen ? 'nav-open' : ''}`}>
            {navOpen ? <button className="shell-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="brand-lockup">
                        <span className="brand-overline">Personal Ledger</span>
                        <h2>ASSET SYSTEM</h2>
                    </div>
                    <button className="sidebar-close" type="button" onClick={() => setNavOpen(false)}>Close</button>
                </div>
                <nav className="sidebar-nav">
                    {(['Operations', 'Library'] as const).map((group) => (
                        <div key={group} className="nav-section">
                            <span className="nav-section-label">{group}</span>
                            {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => {
                                        const active = item.to === '/transactions'
                                            ? isActive && !inTransferWorkspace
                                            : item.to === '/backups'
                                                ? isActive
                                                : isActive;
                                        return active ? 'nav-item active' : 'nav-item';
                                    }}
                                >
                                    <span className="nav-item-label">{item.label}</span>
                                    {item.to === '/backups' ? <span className="badge">Soon</span> : null}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                    <div className="nav-section nav-section--solo">
                        <span className="nav-section-label">Workspace</span>
                        <NavLink to="/transfers" className={() => inTransferWorkspace ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-item-label">Transfers</span>
                        </NavLink>
                    </div>
                </nav>
                <div className="sidebar-footer">
                    <button
                        className="rail-toggle"
                        type="button"
                        onClick={() => setRailCollapsed((value) => !value)}
                    >
                        {railCollapsed ? 'Expand Rail' : 'Collapse Rail'}
                    </button>
                </div>
            </aside>
            <div className="main-content-wrapper">
                <header className="topbar">
                    <div className="topbar-left">
                        <button
                            className="shell-toggle"
                            type="button"
                            onClick={() => {
                                if (window.innerWidth <= 960) {
                                    setNavOpen(true);
                                    return;
                                }
                                setRailCollapsed((value) => !value);
                            }}
                        >
                            Menu
                        </button>
                        <div className="topbar-title-block">
                            <span className="topbar-eyebrow">{pageMeta.eyebrow}</span>
                            <strong className="topbar-title">{pageMeta.title}</strong>
                        </div>
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
                <nav className="mobile-bottom-nav" aria-label="Primary">
                    <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'mobile-nav-item active' : 'mobile-nav-item'}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/transactions" className={({ isActive }) => (isActive && !inTransferWorkspace) ? 'mobile-nav-item active' : 'mobile-nav-item'}>
                        Transactions
                    </NavLink>
                    <NavLink to="/reports" className={({ isActive }) => isActive ? 'mobile-nav-item active' : 'mobile-nav-item'}>
                        Reports
                    </NavLink>
                    <button className="mobile-nav-item" type="button" onClick={() => setNavOpen(true)}>
                        More
                    </button>
                </nav>
            </div>
        </div>
    );
}
