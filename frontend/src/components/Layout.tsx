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
    { to: '/dashboard', label: '대시보드', group: 'Operations' },
    { to: '/transactions', label: '거래 내역', group: 'Operations' },
    { to: '/imports', label: '가져오기', group: 'Operations' },
    { to: '/accounts', label: '계좌 관리', group: 'Library' },
    { to: '/categories', label: '카테고리', group: 'Library' },
    { to: '/reports', label: '보고서', group: 'Library' },
    { to: '/backups', label: '백업', group: 'Library' }
];

function currentPageMeta(pathname: string, search: string) {
    const params = new URLSearchParams(search);
    if (pathname === '/dashboard') return { title: '컨트롤 센터', eyebrow: '운영' };
    if (pathname === '/transactions') {
        return params.get('type') === 'TRANSFER'
            ? { title: '이체 내역', eyebrow: '워크스페이스' }
            : { title: '거래 목록', eyebrow: '운영' };
    }
    if (pathname === '/imports') return { title: '데이터 가져오기', eyebrow: '운영' };
    if (pathname === '/accounts') return { title: '계좌 관리', eyebrow: '라이브러리' };
    if (pathname === '/categories') return { title: '카테고리 관리', eyebrow: '라이브러리' };
    if (pathname === '/reports') return { title: '자산 보고서', eyebrow: '라이브러리' };
    if (pathname === '/backups') return { title: '백업 관리', eyebrow: '라이브러리' };
    return { title: '자산 관리 시스템', eyebrow: '워크스페이스' };
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
                        <span className="brand-overline">개인 가계부</span>
                        <h2>자산 관리 시스템</h2>
                    </div>
                    <button className="sidebar-close" type="button" onClick={() => setNavOpen(false)}>닫기</button>
                </div>
                <nav className="sidebar-nav">
                    {(['운영', '라이브러리'] as const).map((label, idx) => {
                        const group = idx === 0 ? 'Operations' : 'Library';
                        return (
                            <div key={group} className="nav-section">
                                <span className="nav-section-label">{label}</span>
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
                                        {item.to === '/backups' ? <span className="badge">준비 중</span> : null}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                    <div className="nav-section nav-section--solo">
                        <span className="nav-section-label">워크스페이스</span>
                        <NavLink to="/transfers" className={() => inTransferWorkspace ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-item-label">이체 관리</span>
                        </NavLink>
                    </div>
                </nav>
                <div className="sidebar-footer">
                    <button
                        className="rail-toggle"
                        type="button"
                        onClick={() => setRailCollapsed((value) => !value)}
                    >
                        {railCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
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
                            메뉴
                        </button>
                        <div className="topbar-title-block">
                            <span className="topbar-eyebrow">{pageMeta.eyebrow}</span>
                            <strong className="topbar-title">{pageMeta.title}</strong>
                        </div>
                    </div>
                    <div className="topbar-right">
                        {logoutError ? <span className="hint error">{logoutError}</span> : null}
                        <span className="user-email">{me?.email}</span>
                        <button className="btn-logout" onClick={onLogout} disabled={submitting}>로그아웃</button>
                    </div>
                </header>
                <main className="main-content">
                    <Outlet />
                </main>
                <nav className="mobile-bottom-nav" aria-label="Primary">
                    <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'mobile-nav-item active' : 'mobile-nav-item'}>
                        대시보드
                    </NavLink>
                    <NavLink to="/transactions" className={({ isActive }) => (isActive && !inTransferWorkspace) ? 'mobile-nav-item active' : 'mobile-nav-item'}>
                        거래 내역
                    </NavLink>
                    <NavLink to="/reports" className={({ isActive }) => isActive ? 'mobile-nav-item active' : 'mobile-nav-item'}>
                        보고서
                    </NavLink>
                    <button className="mobile-nav-item" type="button" onClick={() => setNavOpen(true)}>
                        더보기
                    </button>
                </nav>
            </div>
        </div>
    );
}
