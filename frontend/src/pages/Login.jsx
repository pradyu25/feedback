import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const { login } = useAuth();
    const navigate = useNavigate();
    const { role } = useParams();

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const roleConfig = {
        student: {
            title: 'Student Portal',
            icon: '🎓',
            gradient: 'from-blue-600 via-cyan-500 to-blue-400',
            glow: 'rgba(59, 130, 246, 0.5)',
            placeholder: 'Enter your Roll ID',
            label: 'Roll ID',
        },
        hod: {
            title: 'HOD Portal',
            icon: '👔',
            gradient: 'from-purple-600 via-pink-500 to-purple-400',
            glow: 'rgba(168, 85, 247, 0.5)',
            placeholder: 'Enter your Username',
            label: 'Username',
        },
        admin: {
            title: 'Admin Portal',
            icon: '⚙️',
            gradient: 'from-orange-600 via-red-500 to-orange-400',
            glow: 'rgba(234, 88, 12, 0.5)',
            placeholder: 'Enter your Username',
            label: 'Username',
        },
    };

    const config = roleConfig[role] || roleConfig.student;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const user = await login({ username, password });
            if (user.role !== role) {
                setError(`Invalid credentials for ${role} portal`);
                setLoading(false);
                return;
            }
            if (user.role === 'student') navigate('/student/dashboard');
            else if (user.role === 'hod') navigate('/hod/dashboard');
            else if (user.role === 'admin') navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden font-['Outfit']">
            {/* Unreal Background Elements */}
            <div className="absolute inset-0 z-0">
                {/* Interactive Mesh Gradient */}
                <div
                    className="absolute inset-0 opacity-40 transition-transform duration-300 ease-out"
                    style={{
                        transform: `translate(${mousePos.x * -1.5}px, ${mousePos.y * -1.5}px)`,
                        background: `radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)`
                    }}
                />

                {/* Floating Orbs */}
                <div
                    className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gradient-to-br ${config.gradient} rounded-full blur-[120px] opacity-20 animate-morph`}
                    style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)` }}
                />
                <div
                    className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gradient-to-tr ${config.gradient} rounded-full blur-[120px] opacity-20 animate-morph`}
                    style={{ transform: `translate(${mousePos.x * -1}px, ${mousePos.y * -1}px)`, animationDelay: '-4s' }}
                />

                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            </div>

            <div className="relative z-10 w-full max-w-md px-4">
                {/* Floating Header */}
                <div
                    className="mb-12 text-center transform transition-transform duration-500"
                    style={{ transform: `translateY(${mousePos.y * 0.5}px)` }}
                >
                    <button
                        onClick={() => navigate('/')}
                        className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all group"
                    >
                        <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Exit to Selection
                    </button>

                    <div className="inline-block relative">
                        <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} blur-3xl opacity-20 animate-pulse`}></div>
                        <div className="relative text-7xl mb-6 animate-float drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                            {config.icon}
                        </div>
                    </div>

                    <h1 className={`text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${config.gradient} tracking-tight mb-2 animate-text-glow`}>
                        {config.title}
                    </h1>
                    <div className={`h-1 w-24 mx-auto rounded-full bg-gradient-to-r ${config.gradient} opacity-50`}></div>
                </div>

                {/* Glass Card */}
                <div
                    className="relative group perspective-1000"
                    style={{
                        transform: `rotateX(${mousePos.y * -0.5}deg) rotateY(${mousePos.x * 0.5}deg)`,
                        transition: 'transform 0.1s ease-out'
                    }}
                >
                    <div className={`absolute -inset-1 bg-gradient-to-r ${config.gradient} rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-700 animate-pulse`}></div>

                    <div className="relative bg-white/[0.03] backdrop-blur-2xl p-10 rounded-[2rem] border border-white/10 shadow-2xl">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 mb-8 rounded-xl text-sm text-center animate-shake backdrop-blur-md">
                                <span className="mr-2">⚠️</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-2 relative group/input">
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within/input:text-white">
                                    {config.label}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-white/5 text-white border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-300 placeholder-gray-600"
                                        placeholder={config.placeholder}
                                        required
                                        disabled={loading}
                                    />
                                    <div className={`absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r ${config.gradient} transition-all duration-500 group-focus-within/input:w-full`}></div>
                                </div>
                            </div>

                            <div className="space-y-2 relative group/input">
                                <label className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within/input:text-white">
                                    Cipher Key
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/5 text-white border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-300 placeholder-gray-600"
                                        placeholder="••••••••"
                                        required
                                        disabled={loading}
                                    />
                                    <div className={`absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r ${config.gradient} transition-all duration-500 group-focus-within/input:w-full`}></div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`relative w-full py-5 rounded-xl bg-white text-black font-black uppercase tracking-widest overflow-hidden group/btn hover:text-white transition-colors duration-300 disabled:opacity-50`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300`}></div>
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Authenticating...
                                        </>
                                    ) : (
                                        <>Access Portal <span className="text-xl">→</span></>
                                    )}
                                </span>
                            </button>
                        </form>

                        <div className="mt-12 text-center space-y-4">
                            <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] font-bold">
                                Department of AIML • Advanced Systems
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
