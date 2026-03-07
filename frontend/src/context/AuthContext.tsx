import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, type AuthMeResponse } from '../api';

interface AuthContextType {
    me: AuthMeResponse | null;
    loading: boolean;
    setMe: (me: AuthMeResponse | null) => void;
    checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [me, setMeState] = useState<AuthMeResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const checkSession = async () => {
        setLoading(true);
        try {
            const current = await getMe();
            setMeState(current);
        } catch {
            setMeState(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        setLoading(true);
        getMe().then((current) => {
            if (!active) return;
            setMeState(current);
        }).catch(() => {
            if (!active) return;
            setMeState(null);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, []);

    return (
        <AuthContext.Provider value={{ me, loading, setMe: setMeState, checkSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
