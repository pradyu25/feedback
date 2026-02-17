import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { useAuth } from '../context/AuthContext';
import { FaSignOutAlt } from 'react-icons/fa';

const FeedbackForm = () => {
    const { subjectId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();

    const subjectName = location.state?.subjectName || 'Course';
    const facultyName = location.state?.facultyName || 'Faculty';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Hardcoded questions fallback or fetch from API
    // Actually, API /api/student/questions/:subjectId returns { questions: [], type: '' }
    const [questions, setQuestions] = useState([]);
    const [responses, setResponses] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const { data } = await api.get(`/student/questions/${subjectId}`);
                if (data.questions && Array.isArray(data.questions)) {
                    setQuestions(data.questions);
                    // Initialize responses with existing ones or empty
                    const initial = {};
                    if (data.existingResponses) {
                        data.existingResponses.forEach(r => {
                            initial[r.questionIndex] = r.rating;
                        });
                    }
                    setResponses(initial);
                }
            } catch (err) {
                setError('Failed to load questions. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchQuestions();
    }, [subjectId]);

    const handleRatingChange = (idx, rating) => {
        setResponses((prev) => ({
            ...prev,
            [idx]: rating,
        }));
    };

    const isComplete = () => {
        return questions.every((_, idx) => responses[idx] > 0);
    };

    const handleSubmit = async () => {
        if (!isComplete()) {
            alert('Please answer all questions before submitting.');
            return;
        }

        setSubmitting(true);
        try {
            // Format responses for backend: array of objects { questionIndex, rating }
            const formattedResponses = Object.keys(responses).map((idx) => ({
                questionIndex: parseInt(idx),
                rating: responses[idx],
            }));

            await api.post('/student/submit-feedback', {
                subjectId,
                responses: formattedResponses,
            });

            const subjectList = location.state?.subjectList || [];
            // Update the local list status to find the next one
            const updatedList = subjectList.map(s =>
                s.subjectId === subjectId ? { ...s, status: 'done', canResubmit: false } : s
            );

            // Find next pending subject
            const nextSubject = updatedList.find(s => s.status !== 'done');

            if (nextSubject) {
                navigate(`/student/feedback/${nextSubject.subjectId}`, {
                    state: {
                        subjectName: nextSubject.subjectName,
                        facultyName: nextSubject.facultyName,
                        subjectList: updatedList
                    },
                    replace: true
                });
            } else {
                // All done
                navigate('/student/dashboard');
            }
        } catch (err) {
            console.error(err);
            alert('Submission failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-black"></div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
            <div className="text-red-500 font-bold bg-white p-6 rounded-xl shadow-lg border border-red-100">{error}</div>
        </div>
    );

    const progress = (Object.keys(responses).length / questions.length) * 100;

    return (
        <div className="min-h-screen bg-gray-50 font-['Outfit'] py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 mb-8 border border-gray-100 relative overflow-hidden">
                    <button
                        onClick={handleLogout}
                        className="absolute top-4 right-4 p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors z-20"
                        title="Logout"
                    >
                        <FaSignOutAlt />
                    </button>
                    <div className="absolute top-0 left-0 w-full h-2 bg-black"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-4">
                        <div>
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Feedback Form</h2>
                            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">{subjectName}</h1>
                            <p className="text-xl text-gray-500 font-medium">Faculty: <span className="text-black">{facultyName}</span></p>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Progress</div>
                            <div className="text-3xl font-black text-black">{Math.round(progress)}%</div>
                        </div>
                    </div>
                </div>

                {/* Questions */}
                <div className="space-y-6">
                    {questions.map((q, idx) => (
                        <div key={idx} className={`bg-white p-8 rounded-3xl shadow-sm border transition-all duration-300 ${responses[idx] ? 'border-gray-200 shadow-md' : 'border-gray-100 hover:border-gray-300 hover:shadow-lg'
                            }`}>
                            <div className="flex flex-col gap-6">
                                <div className="flex items-start gap-4">
                                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </span>
                                    <p className="text-lg font-bold text-gray-800 pt-1 leading-relaxed">{q}</p>
                                </div>

                                <div className="ml-12 grid grid-cols-5 gap-4 max-w-lg">
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                        <button
                                            key={rating}
                                            onClick={() => handleRatingChange(idx, rating)}
                                            className={`group relative aspect-square rounded-2xl font-black text-lg transition-all duration-200 flex flex-col items-center justify-center gap-1 ${responses[idx] === rating
                                                ? 'bg-black text-white shadow-xl shadow-black/20 scale-110'
                                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900'
                                                }`}
                                        >
                                            {rating}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="mt-12 flex items-center justify-between bg-white p-6 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
                    <button
                        onClick={() => navigate('/student/dashboard')}
                        className="px-8 py-4 rounded-xl font-bold text-gray-500 hover:text-black hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isComplete() || submitting}
                        className={`px-10 py-4 rounded-xl font-black text-white uppercase tracking-widest transition-all transform ${(!isComplete() || submitting)
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-black hover:bg-gray-900 hover:scale-105 shadow-xl shadow-black/20'
                            }`}
                    >
                        {submitting ? 'Sending...' : 'Submit Feedback'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackForm;
