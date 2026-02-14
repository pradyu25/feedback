import { useState, useEffect } from 'react';
import api from '../utils/axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { FaChalkboardTeacher, FaBook, FaLayerGroup, FaChartPie, FaDownload, FaFilter } from 'react-icons/fa';


ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'Outfit', weight: 'bold' } },
            grid: { color: 'rgba(255,255,255,0.05)' },
        },
        x: {
            ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'Outfit', weight: 'bold' } },
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

    if (loading && !analytics) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin-slow rounded-full h-16 w-16 border-t-2 border-purple-500"></div>
                    <p className="text-white mt-4 text-lg animate-pulse font-['Outfit']">Decrypting Analytics...</p>
                </div>
            </div>
        );
    }

    const views = [
        { id: 'overview', name: 'Overview', icon: <FaChartPie /> },
        { id: 'faculty', name: 'Faculty Wise', icon: <FaChalkboardTeacher /> },
        { id: 'subject', name: 'Subject Wise', icon: <FaBook /> },
    ];

    const getChartData = (data, label, color) => ({
        labels: data.map(d => d.name),
        datasets: [{
            label: label,
            data: data.map(d => d.average),
            backgroundColor: color,
            borderRadius: 8,
            borderWidth: 0,
        }],
    });

    const renderView = () => {
        if (!analytics) return null;

        switch (activeView) {
            case 'faculty':
                return <ReportView title="Faculty Performance" data={analytics.facultyReport || []} color="rgba(139, 92, 246, 0.6)" />;
            case 'subject':
                return <ReportView title="Subject Performance" data={analytics.subjectReport || []} color="rgba(236, 72, 153, 0.6)" />;

            default:
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatCard title="Total Students" value={analytics.totalStudents} gradient="from-blue-500 to-cyan-500" />
                            <StatCard title="Submitted" value={analytics.completedCount} gradient="from-green-500 to-emerald-500" />
                            <StatCard title="Participation" value={analytics.totalStudents > 0 ? `${((analytics.completedCount / analytics.totalStudents) * 100).toFixed(1)}%` : '0.0%'} gradient="from-purple-500 to-pink-500" />
                            <StatCard title="Not Submitted" value={analytics.notSubmittedCount} gradient="from-red-500 to-orange-500" />
                        </div>

                        {/* Top Performers */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="text-purple-400"><FaChalkboardTeacher /></span> Faculty Leaderboard
                                </h3>
                                <div className="space-y-4">
                                    {(analytics.facultyReport || []).slice(0, 5).sort((a, b) => b.average - a.average).map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                                            <span className="text-white font-medium">{f.name}</span>
                                            <span className="text-purple-400 font-bold">{f.average}%</span>
                                        </div>
                                    ))}
                                    {(!analytics.facultyReport || analytics.facultyReport.length === 0) && (
                                        <p className="text-gray-500 text-center py-10">No faculty data yet</p>
                                    )}
                                </div>
                            </div>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="text-pink-400"><FaBook /></span> Subject Insights
                                </h3>
                                <div className="h-64">
                                    {analytics.subjectReport && analytics.subjectReport.length > 0 ? (
                                        <Bar
                                            data={getChartData(analytics.subjectReport.slice(0, 5), 'Avg Score %', 'rgba(236, 72, 153, 0.6)')}
                                            options={chartOptions}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-500 italic">
                                            No subject data available
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white font-['Outfit'] flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 bg-[#0f172a]/50 backdrop-blur-3xl border-r border-white/10 flex flex-col z-20 transition-all">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-xl shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                            <FaLayerGroup />
                        </div>
                        <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 tracking-tighter">
                            AIML CORE
                        </h2>
                    </div>

                    <nav className="space-y-2">
                        {views.map(view => (
                            <button
                                key={view.id}
                                onClick={() => setActiveView(view.id)}
                                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${activeView === view.id
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <span className={`${activeView === view.id ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                                    {view.icon}
                                </span>
                                <span className="font-bold tracking-tight">{view.name}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-8 border-t border-white/5">
                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-3xl border border-white/10">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Export Reports</p>
                        <div className="grid grid-cols-3 gap-2">
                            {['pdf', 'excel', 'word'].map(fmt => (
                                <button
                                    key={fmt}
                                    onClick={() => handleExport(fmt)}
                                    disabled={exporting}
                                    className="p-3 bg-white/5 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center group"
                                    title={`Export as ${fmt}`}
                                >
                                    <FaDownload className={`text-xs ${exporting ? 'animate-bounce' : 'group-hover:scale-125 transition-transform'}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-10 relative">
                {/* Header Controls */}
                <header className="flex flex-wrap items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
                            Dashboard <span className="text-purple-500">.</span>
                        </h1>
                        <p className="text-gray-400 font-medium">Monitoring {views.find(v => v.id === activeView)?.name} Analysis</p>
                    </div>

                    <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500 transition-colors">
                            <FaFilter className="text-purple-400 text-xs" />
                            <select
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer text-white"
                            >
                                <option value={2} className="bg-[#0f172a] text-white">Year 2</option>
                                <option value={3} className="bg-[#0f172a] text-white">Year 3</option>
                                <option value={4} className="bg-[#0f172a] text-white">Year 4</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5 hover:border-pink-500 transition-colors">
                            <FaLayerGroup className="text-pink-400 text-xs" />
                            <select
                                value={semester}
                                onChange={(e) => setSemester(e.target.value)}
                                className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer text-white"
                            >
                                <option value={1} className="bg-[#0f172a] text-white">Semester I</option>
                                <option value={2} className="bg-[#0f172a] text-white">Semester II</option>
                            </select>
                        </div>
                    </div>
                </header>

                {renderView()}

                {/* Background Decorations */}
                <div className="fixed top-1/2 right-0 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
                <div className="fixed bottom-0 left-1/2 w-96 h-96 bg-pink-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
            </main>
        </div>
    );
};

// Sub-components
const StatCard = ({ title, value, gradient }) => (
    <div className="relative group perspective-1000">
        <div className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500`}></div>
        <div className="relative bg-[#0f172a]/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 flex flex-col items-center text-center transform group-hover:translate-z-10 transition-transform">
            <h3 className="text-gray-400 text-xs font-black uppercase tracking-[0.2em] mb-4">{title}</h3>
            <p className={`text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r ${gradient}`}>
                {value}
            </p>
        </div>
    </div>
);

const ReportView = ({ title, data, color }) => {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-20 rounded-[2.5rem] text-center animate-in fade-in duration-700">
                <div className="text-6xl mb-6 opacity-20">📂</div>
                <h2 className="text-2xl font-bold text-gray-400 font-['Outfit']">No Analytics Data Available</h2>
                <p className="text-gray-500 mt-2 font-medium">Try selecting a different academic year or semester.</p>
            </div>
        );
    }
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem]">
                <h2 className="text-2xl font-black text-white mb-8">{title} Analysis</h2>
                <div className="h-[400px]">
                    <Bar
                        data={{
                            labels: data.map(d => d.name),
                            datasets: [{
                                label: 'Average Score (%)',
                                data: data.map(d => d.average),
                                backgroundColor: color,
                                borderRadius: 12,
                            }]
                        }}
                        options={chartOptions}
                    />
                </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] overflow-hidden">
                <h2 className="text-2xl font-black text-white mb-8">Detailed Stats</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                            <tr>
                                <th className="px-8 py-4">S.No</th>
                                <th className="px-8 py-4">Name</th>
                                <th className="px-8 py-4">Avg Score</th>
                                <th className="px-8 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.map((item, idx) => {
                                const score = parseFloat(item.average);
                                const rating = score >= 90 ? 'High' : score >= 75 ? 'Mid' : 'Low';
                                const badgeColor = score >= 90 ? 'bg-green-500' : score >= 75 ? 'bg-blue-500' : 'bg-red-500';

                                return (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-8 py-6 text-gray-500 font-bold">{idx + 1}</td>
                                        <td className="px-8 py-6 text-white font-bold">{item.name}</td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden w-24">
                                                    <div className={`h-full ${item.average >= 90 ? 'bg-purple-500' : 'bg-pink-500'} transition-all`} style={{ width: `${item.average}%` }}></div>
                                                </div>
                                                <span className="text-sm font-black">{item.average}%</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-white font-bold">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${badgeColor}/20 text-white border border-${badgeColor.split('-')[1]}-500/30`}>
                                                {rating}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


export default HodDashboard;
