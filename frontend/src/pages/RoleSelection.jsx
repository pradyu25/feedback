import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const RoleSelection = () => {
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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

    const roles = [
        {
            id: 'student',
            title: 'Student',
            description: 'Participate in course evaluations',
            icon: '🎓',
            gradient: 'from-blue-600 to-cyan-400',
        },
        {
            id: 'hod',
            title: 'HOD',
            description: 'Monitor quality and generate reports',
            icon: '👔',
            gradient: 'from-purple-600 to-pink-500',
        },
        {
            id: 'admin',
            title: 'Admin',
            description: 'System orchestration and data seeding',
            icon: '⚙️',
            gradient: 'from-orange-600 to-red-500',
        },
    ];

    const handleRoleSelect = (roleId) => {
        setSelectedRole(roleId);
        setTimeout(() => {
            navigate(`/login/${roleId}`);
        }, 500);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden font-['Outfit']">
            {/* Unreal Background Elements */}
            <div className="absolute inset-0 z-0">
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        transform: `translate(${mousePos.x * -1}px, ${mousePos.y * -1}px)`,
                        background: `radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)`
                    }}
                />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]"></div>

                {/* Floating Glows */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 blur-[120px] animate-pulse transition-delay-1000"></div>
            </div>

            <div className="relative z-10 w-full max-w-6xl px-4">
                {/* Header */}
                <div className="text-center mb-20 space-y-4">
                    <h1 className="text-7xl font-black tracking-tighter">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-text-glow leading-tight">
                            AIML Feedback System
                        </span>
                    </h1>
                    <p className="text-gray-500 text-xl font-medium tracking-wide uppercase">
                        Select your access portal to begin
                    </p>
                    <div className="h-1.5 w-40 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full opacity-50"></div>
                </div>

                {/* Role Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {roles.map((role) => (
                        <div
                            key={role.id}
                            onClick={() => handleRoleSelect(role.id)}
                            className={`group relative cursor-pointer transform transition-all duration-700 perspective-1000 ${selectedRole === role.id ? 'scale-110 rotate-y-12 blur-none' : selectedRole ? 'scale-90 opacity-40 blur-sm' : 'hover:scale-105'
                                }`}
                        >
                            <div className={`absolute -inset-1 bg-gradient-to-r ${role.gradient} rounded-[2.5rem] blur opacity-20 group-hover:opacity-60 transition duration-700`}></div>

                            <div className="relative bg-[#0f172a]/80 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/10 h-full overflow-hidden group">
                                <div className="relative z-10">
                                    <div className="text-8xl mb-8 transform group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500 animate-float">
                                        {role.icon}
                                    </div>

                                    <h3 className={`text-4xl font-black mb-4 bg-gradient-to-r ${role.gradient} text-transparent bg-clip-text tracking-tight uppercase`}>
                                        {role.title}
                                    </h3>

                                    <p className="text-gray-400 text-lg font-medium leading-relaxed mb-8">
                                        {role.description}
                                    </p>

                                    <div className={`inline-flex items-center gap-2 font-black text-xs uppercase tracking-[0.2em] px-6 py-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors`}>
                                        Authorize Access <span>→</span>
                                    </div>
                                </div>

                                {/* Floating Shapes in Card */}
                                <div className={`absolute -right-10 -bottom-10 w-40 h-40 bg-gradient-to-br ${role.gradient} opacity-5 group-hover:opacity-20 transition-opacity rounded-full blur-3xl`}></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="text-center mt-20">
                    <p className="text-gray-600 text-xs font-black uppercase tracking-[0.6em] transition-all hover:tracking-[0.8em] cursor-default">
                        Designated for AIML Department • Core Systems
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RoleSelection;
