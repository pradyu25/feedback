import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Layout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const roleConfig = {
        student: {
            icon: '🎓',
            gradient: 'from-blue-500 to-cyan-500',
        },
        hod: {
            icon: '👔',
            gradient: 'from-purple-500 to-pink-500',
        },
        admin: {
            icon: '⚙️',
            gradient: 'from-orange-500 to-red-500',
        },
    };

    const config = roleConfig[user?.role] || roleConfig.student;

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
            {/* Header */}
            <header className="bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/10 shadow-2xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        {/* Logo & Brand */}
                        <div className="flex items-center gap-4">
                            <div className="text-3xl">{config.icon}</div>
                            <div>
                                <h1 className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${config.gradient}`}>
                                    Feedback System
                                </h1>
                                <p className="text-gray-400 text-xs uppercase tracking-wider">
                                    {user?.role?.toUpperCase()} Portal
                                </p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center gap-4">
                            {user?.role === 'student' && (
                                <Link
                                    to="/student/dashboard"
                                    className="text-gray-300 hover:text-white transition-colors font-medium"
                                >
                                    Dashboard
                                </Link>
                            )}
                            {user?.role === 'hod' && (
                                <Link
                                    to="/hod/dashboard"
                                    className="text-gray-300 hover:text-white transition-colors font-medium"
                                >
                                    Analytics
                                </Link>
                            )}
                            {user?.role === 'admin' && (
                                <Link
                                    to="/admin/dashboard"
                                    className="text-gray-300 hover:text-white transition-colors font-medium"
                                >
                                    Control Panel
                                </Link>
                            )}

                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-lg hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-red-500/50"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-[#0f172a]/80 backdrop-blur-xl border-t border-white/10 text-center py-6">
                <p className="text-gray-400 text-sm">
                    © {new Date().getFullYear()} AIML Department - Faculty Feedback System
                </p>
                <p className="text-gray-500 text-xs mt-1">
                    Powered by Advanced Analytics
                </p>
            </footer>
        </div>
    );
};

export default Layout;
