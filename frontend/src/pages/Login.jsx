import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Unified login - backend handles role detection
            const user = await login({ username, password });

            // Redirect based on role returned from backend
            if (user.role === 'student') navigate('/student/dashboard');
            else if (user.role === 'hod') navigate('/hod/dashboard');
            else if (user.role === 'admin') navigate('/admin/dashboard');
            else {
                setError('Unknown role detected. Contact admin.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-['Outfit']">
            {/* Left Side - Black Branding */}
            <div className="hidden lg:flex w-1/3 bg-[#0f172a] text-white flex-col justify-between p-12 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-black text-2xl font-black mb-6">
                        A
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Department of AIML, NNRG</h1>
                    <p className="text-gray-400">Feedback System</p>
                </div>

                <div className="relative z-10">
                    <blockquote className="text-xl font-medium leading-relaxed opacity-80">
                        "Empowering education through continuous improvement and transparent feedback mechanisms."
                    </blockquote>
                </div>

                {/* Abstract Decoration */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] transform -translate-x-1/2 translate-y-1/2"></div>
            </div>

            {/* Right Side - White Login Form */}
            <div className="flex-1 bg-white flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Welcome back</h2>
                        <p className="mt-2 text-gray-500">Please enter your details to sign in.</p>
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm font-medium flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                User ID / Roll Number
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all font-medium placeholder-gray-400"
                                placeholder="Enter your ID"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all font-medium placeholder-gray-400"
                                placeholder="••••••••"
                                required
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-xl bg-[#0f172a] text-white font-bold text-lg hover:bg-black transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-gray-200"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Verifying Creds...
                                </span>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="pt-6 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                            Secure System • Department of AIML
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
