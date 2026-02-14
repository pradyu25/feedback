import { useState, useEffect } from 'react';
import api from '../utils/axios';
import { Link } from 'react-router-dom';

const StudentDashboard = () => {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const { data } = await api.get('/student/dashboard');
                setSubjects(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                    <p className="text-white mt-4 text-lg">Loading subjects...</p>
                </div>
            </div>
        );
    }

    const totalSubjects = subjects.length;
    const completedCount = subjects.filter((s) => s.status === 'done').length;
    const completionPercentage = totalSubjects > 0 ? (completedCount / totalSubjects) * 100 : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">
                        Course Feedback
                    </h1>
                    <p className="text-gray-400">Submit feedback for your enrolled subjects</p>
                </div>

                {/* Progress Card */}
                <div className="relative group mb-8">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                    <div className="relative bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="text-3xl">📊</div>
                            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                Overall Progress
                            </h2>
                        </div>

                        <div className="relative w-full bg-[#1e293b] rounded-full h-6 overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500 rounded-full"
                                style={{ width: `${completionPercentage}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-3 text-sm">
                            <span className="text-gray-300 font-medium">
                                {completedCount} / {totalSubjects} Completed
                            </span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-bold">
                                {completionPercentage.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Subjects Grid */}
                {subjects.length === 0 ? (
                    <div className="text-center text-gray-400 mt-12">
                        <div className="text-6xl mb-4">📚</div>
                        <p className="text-xl">No subjects found for your enrollment.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subjects.map((subject) => {
                            const statusConfig = {
                                'done': {
                                    gradient: 'from-green-500 to-emerald-500',
                                    textColor: 'text-green-400',
                                    label: 'COMPLETED',
                                },
                                'in progress': {
                                    gradient: 'from-yellow-500 to-orange-500',
                                    textColor: 'text-yellow-400',
                                    label: 'IN PROGRESS',
                                },
                                'not submitted': {
                                    gradient: 'from-red-500 to-pink-500',
                                    textColor: 'text-red-400',
                                    label: 'NOT SUBMITTED',
                                },
                            };

                            const config = statusConfig[subject.status] || statusConfig['not submitted'];

                            return (
                                <div key={subject.subjectId} className="relative group">
                                    <div className={`absolute -inset-0.5 bg-gradient-to-r ${config.gradient} rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500`}></div>
                                    <div className="relative bg-[#0f172a]/90 backdrop-blur-xl p-6 rounded-2xl border border-white/10 h-full flex flex-col">
                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold text-white mb-1">
                                                    {subject.subjectCode}
                                                </h3>
                                                <p className="text-gray-400 text-sm">
                                                    {subject.subjectName}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${subject.type === 'theory'
                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                                                }`}>
                                                {subject.type.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Faculty Info */}
                                        <div className="mb-6 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-sm">Faculty:</span>
                                                <span className="text-white font-medium">
                                                    {subject.facultyName || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-sm">Status:</span>
                                                <span className={`${config.textColor} font-bold text-sm`}>
                                                    {config.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <div className="mt-auto">
                                            {subject.status === 'done' && !subject.canResubmit ? (
                                                <div className="text-center">
                                                    <button
                                                        disabled
                                                        className="w-full py-3 rounded-lg bg-gray-700/50 text-gray-500 font-bold cursor-not-allowed border border-white/5"
                                                    >
                                                        ✓ Submitted
                                                    </button>
                                                    <p className="text-[10px] text-gray-500 mt-2 font-black uppercase tracking-widest">
                                                        Next submission in {subject.daysUntilResubmit} days
                                                    </p>
                                                </div>
                                            ) : (
                                                <Link
                                                    to={`/student/feedback/${subject.subjectId}`}
                                                    state={{
                                                        subjectName: subject.subjectName,
                                                        facultyName: subject.facultyName,
                                                        subjectList: subjects // Pass full list for autoprogress
                                                    }}
                                                    className={`block text-center w-full py-3 rounded-lg bg-gradient-to-r ${config.gradient} text-white font-bold shadow-lg hover:scale-105 transform transition-all duration-200`}
                                                >
                                                    {subject.status === 'done' ? '→ Update Feedback' :
                                                        subject.status === 'in progress' ? '→ Continue Feedback' :
                                                            '→ Start Feedback'}
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentDashboard;
