import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import TransactionsPage from './pages/TransactionsPage';
import CategoriesPage from './pages/CategoriesPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ReportsPage from './pages/ReportsPage';
import ImportsPage from './pages/ImportsPage';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />

              <Route path="/transfers" element={<Navigate to="/transactions?type=TRANSFER" replace />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/imports" element={<ImportsPage />} />
              <Route path="/backups" element={<PlaceholderPage title="Backups" slice={7} />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
