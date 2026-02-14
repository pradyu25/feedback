import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/axios';

const FeedbackForm = () => {
    const { subjectId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const subjectName = location.state?.subjectName || 'Course';

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
                    data.questions.forEach((_, idx) => {
                        const existing = data.existingResponses?.find(r => r.questionIndex === idx);
                        initial[idx] = existing ? existing.rating : 0;
                    });
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
            const updatedList = subjectList.map(s =>
                s.subjectId === subjectId ? { ...s, status: 'done', canResubmit: false } : s
            );
            const nextSubject = updatedList.find(s => s.status !== 'done' || s.canResubmit);

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
                alert('All feedbacks submitted successfully!');
                navigate('/student/dashboard');
            }
        } catch (err) {
            console.error(err);
            alert('Submission failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-white text-center p-8">Loading feedback form...</div>;
    if (error) return <div className="text-red-500 text-center p-8">{error}</div>;

    return (
        <div className="container mx-auto max-w-4xl p-4">
            <h1 className="text-3xl font-bold text-aiml-accent mb-2">Feedback: {subjectName}</h1>
            <p className="text-aiml-silver mb-8">Please rate the following aspects honestly.</p>

            <div className="space-y-6">
                {questions.map((q, idx) => (
                    <div key={idx} className="bg-aiml-navy-light p-6 rounded shadow-md border-l-4 border-aiml-accent">
                        <p className="text-lg text-white mb-4">{idx + 1}. {q}</p>
                        <div className="flex space-x-4">
                            {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => handleRatingChange(idx, rating)}
                                    className={`w-10 h-10 rounded-full font-bold focus:outline-none transition-colors duration-200 ${responses[idx] === rating
                                        ? 'bg-aiml-accent text-aiml-navy border-2 border-white'
                                        : 'bg-aiml-navy text-aiml-silver border border-aiml-silver hover:border-aiml-accent'
                                        }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-aiml-silver mt-2 px-1">
                            <span>Poor</span>
                            <span>Excellent</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex justify-end space-x-4">
                <button
                    onClick={() => navigate('/student/dashboard')}
                    className="px-6 py-2 rounded border border-aiml-silver text-aiml-silver hover:text-white"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!isComplete() || submitting}
                    className={`px-8 py-2 rounded font-bold text-aiml-navy bg-aiml-accent hover:bg-opacity-90 transition duration-200 ${(!isComplete() || submitting) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                >
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
            </div>
        </div>
    );
};

export default FeedbackForm;
