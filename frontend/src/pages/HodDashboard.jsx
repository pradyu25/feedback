import { useState, useEffect } from 'react';
import api from '../utils/axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FaChalkboardTeacher, FaBook, FaLayerGroup, FaChartPie, FaFilter, FaChevronDown, FaChevronUp, FaFilePdf, FaFileExcel, FaFileWord, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: '#94a3b8', font: { family: 'Outfit', weight: 'bold' } },
            grid: { color: '#e2e8f0' },
        },
        x: {
            ticks: { color: '#94a3b8', font: { family: 'Outfit', weight: 'bold' } },
            grid: { display: false },
        },
    },
};

const HodDashboard = () => {
    const [year, setYear] = useState(3);
    const [semester, setSemester] = useState(5);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeView, setActiveView] = useState('overview'); // overview, faculty, subject
    const [expandedFaculty, setExpandedFaculty] = useState(null);

    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/hod/analytics?year=${year}&semester=${semester}`);
                setAnalytics(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [year, semester]);

    const handleExport = async (format) => {
        setExporting(true);
        try {
            const response = await api.get(`/hod/export/${format}?year=${year}&semester=${semester}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf';
            link.setAttribute('download', `Feedback_Report_Y${year}_S${semester}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(false);
        }
    };

    const toggleFacultyExpand = (id) => {
        setExpandedFaculty(expandedFaculty === id ? null : id);
    };

    if (loading && !analytics) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-black"></div>
                    <p className="text-gray-500 mt-4 text-sm font-bold tracking-widest uppercase">Loading Analytics...</p>
                </div>
            </div>
        );
    }

    const views = [
        { id: 'overview', name: 'Overview', icon: <FaChartPie /> },
        { id: 'faculty', name: 'Faculty Wise', icon: <FaChalkboardTeacher /> },
        { id: 'subject', name: 'Subject Wise', icon: <FaBook /> },
    ];

    const renderView = () => {
        if (!analytics) return null;

        switch (activeView) {
            case 'faculty':
                return (
                    <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b border-gray-100">
                            <h2 className="text-2xl font-black text-gray-900">Faculty Performance</h2>
                            <p className="text-gray-500">Detailed breakdown of faculty scores. Click rows for question-wise analysis.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-8 py-4">Name</th>
                                        <th className="px-8 py-4 text-center">Avg Score</th>
                                        <th className="px-8 py-4 text-center">Status</th>
                                        <th className="px-8 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(analytics.facultyReport || []).map((f, idx) => (
                                        <>
                                            <tr
                                                key={idx}
                                                onClick={() => toggleFacultyExpand(idx)}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-8 py-6 font-bold text-gray-900">{f.name}</td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${f.average >= 90 ? 'bg-green-100 text-green-700' :
                                                        f.average >= 75 ? 'bg-blue-100 text-blue-700' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {f.average}%
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    {f.average >= 90 ? 'Excellent' : f.average >= 75 ? 'Good' : 'Needs Improvement'}
                                                </td>
                                                <td className="px-8 py-6 text-right text-gray-400">
                                                    {expandedFaculty === idx ? <FaChevronUp /> : <FaChevronDown />}
                                                </td>
                                            </tr>
                                            {expandedFaculty === idx && f.questions && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan="4" className="px-8 py-6">
                                                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Question Wise Breakdown</h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {f.questions.map((q, qIdx) => (
                                                                    <div key={qIdx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                                        <span className="text-sm font-medium text-gray-600">Q{q.questionIndex + 1}</span>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                                                <div
                                                                                    className="h-full bg-black rounded-full"
                                                                                    style={{ width: `${q.average}%` }}
                                                                                ></div>
                                                                            </div>
                                                                            <span className="text-sm font-bold text-gray-900">{q.average}%</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {(!f.questions || f.questions.length === 0) && (
                                                                    <p className="text-sm text-gray-400 italic">No detailed question data available.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            case 'subject':
                return (
                    <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
                        <h2 className="text-2xl font-black text-gray-900 mb-8">Subject Performance</h2>
                        <div className="h-[400px]">
                            <Bar
                                data={{
                                    labels: (analytics.subjectReport || []).map(d => d.name),
                                    datasets: [{
                                        label: 'Average Score (%)',
                                        data: (analytics.subjectReport || []).map(d => d.average),
                                        backgroundColor: '#0f172a',
                                        borderRadius: 8,
                                    }]
                                }}
                                options={chartOptions}
                            />
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatCard title="Total Students" value={analytics.totalStudents} />
                            <StatCard title="Submitted" value={analytics.completedCount} />
                            <StatCard title="Participation" value={analytics.totalStudents > 0 ? `${((analytics.completedCount / analytics.totalStudents) * 100).toFixed(1)}%` : '0.0%'} />
                            <StatCard title="Pending" value={analytics.notSubmittedCount} />
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xl shadow-gray-200/50">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Faculty Leaderboard</h3>
                                <div className="space-y-4">
                                    {(analytics.facultyReport || []).slice(0, 5).sort((a, b) => b.average - a.average).map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                                                <span className="text-gray-700 font-bold">{f.name}</span>
                                            </div>
                                            <span className="text-black font-black">{f.average}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xl shadow-gray-200/50">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Subject Insights</h3>
                                <div className="h-64">
                                    <Bar
                                        data={{
                                            labels: (analytics.subjectReport || []).slice(0, 5).map(d => d.name),
                                            datasets: [{
                                                label: 'Avg Score %',
                                                data: (analytics.subjectReport || []).slice(0, 5).map(d => d.average),
                                                backgroundColor: '#334155',
                                                borderRadius: 6,
                                            }]
                                        }}
                                        options={chartOptions}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-['Outfit'] flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 bg-[#0f172a] text-white flex flex-col z-20">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black text-xl font-black">
                            A
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">AIML CORE</h2>
                    </div>

                    <nav className="space-y-2">
                        {views.map(view => (
                            <button
                                key={view.id}
                                onClick={() => setActiveView(view.id)}
                                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${activeView === view.id
                                    ? 'bg-white text-black shadow-lg font-bold'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                <span className={`${activeView === view.id ? '' : 'opacity-70 group-hover:opacity-100'}`}>
                                    {view.icon}
                                </span>
                                <span className="tracking-tight">{view.name}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-8 border-t border-white/5 space-y-6">
                    <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Export Reports</p>
                        <div className="grid grid-cols-3 gap-2">
                            {['pdf', 'excel', 'word'].map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => handleExport(fmt)}
                                    disabled={exporting}
                                    className="p-3 bg-white/5 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center text-gray-400 hover:text-white"
                                    title={`Export as ${fmt}`}
                                >
                                    {fmt === 'pdf' && <FaFilePdf className="text-red-400" />}
                                    {fmt === 'excel' && <FaFileExcel className="text-green-400" />}
                                    {fmt === 'word' && <FaFileWord className="text-blue-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all"
                    >
                        <FaSignOutAlt />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-10">
                <header className="flex flex-wrap items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">
                            Dashboard
                        </h1>
                        <p className="text-gray-500 font-medium">{views.find(v => v.id === activeView)?.name} Analysis</p>
                    </div>

                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                            <FaFilter className="text-gray-400 text-xs" />
                            <select
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer text-gray-700"
                            >
                                <option value={2}>Year 2</option>
                                <option value={3}>Year 3</option>
                                <option value={4}>Year 4</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                            <FaLayerGroup className="text-gray-400 text-xs" />
                            <select
                                value={semester}
                                onChange={(e) => setSemester(e.target.value)}
                                className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer text-gray-700"
                            >
                                <option value={1}>Semester I</option>
                                <option value={2}>Semester II</option>
                                <option value={5}>Semester V</option>
                            </select>
                        </div>
                    </div>
                </header>

                {renderView()}
            </main>
        </div>
    );
};

const StatCard = ({ title, value }) => (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-center justify-center text-center">
        <h3 className="text-gray-400 text-xs font-black uppercase tracking-[0.2em] mb-4">{title}</h3>
        <p className="text-4xl font-black text-gray-900">{value}</p>
    </div>
);

export default HodDashboard;
