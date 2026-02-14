import { useState, useEffect } from 'react';
import api from '../utils/axios';

const AdminDashboard = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null);
    const [questionType, setQuestionType] = useState('theory');
    const [questionText, setQuestionText] = useState('');
    const [questions, setQuestions] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [existingSets, setExistingSets] = useState([]);
    const [editingSetId, setEditingSetId] = useState(null);

    const fetchQuestionSets = async () => {
        try {
            const { data } = await api.get('/admin/questions');
            setExistingSets(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchQuestionSets();
    }, []);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setMessage(null);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
                setFile(droppedFile);
                setMessage(null);
            } else {
                setMessage('Please upload an Excel file (.xlsx or .xls)');
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setMessage(null);

        try {
            const { data } = await api.post('/admin/upload-excel', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setMessage({
                type: 'success',
                text: `Upload successful! Students: ${data.results.students}, Faculty: ${data.results.faculty}, Subjects: ${data.results.subjects}`
            });
            setFile(null);
        } catch (error) {
            setMessage({
                type: 'error',
                text: 'Upload failed. Please check the file format.'
            });
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const handleAddQuestion = () => {
        if (questionText.trim()) {
            setQuestions([...questions, questionText.trim()]);
            setQuestionText('');
        }
    };

    const handleRemoveQuestion = (index) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const handleSaveQuestions = async () => {
        try {
            if (editingSetId) {
                await api.put(`/admin/questions/${editingSetId}`, {
                    type: questionType,
                    questions,
                });
                alert('Question set updated!');
            } else {
                await api.post('/admin/questions', {
                    type: questionType,
                    questions,
                    isActive: true,
                });
                alert('Questions saved and activated!');
            }
            setQuestions([]);
            setEditingSetId(null);
            fetchQuestionSets();
        } catch (error) {
            console.error(error);
            alert('Failed to save questions');
        }
    };

    const handleDeleteSet = async (id) => {
        if (window.confirm('Are you sure you want to delete this question set?')) {
            try {
                await api.delete(`/admin/questions/${id}`);
                fetchQuestionSets();
            } catch (error) {
                console.error(error);
                alert('Failed to delete question set');
            }
        }
    };

    const handleActivateSet = async (id) => {
        try {
            await api.patch(`/admin/questions/${id}/activate`);
            fetchQuestionSets();
            alert('Question set activated!');
        } catch (error) {
            console.error(error);
            alert('Failed to activate question set');
        }
    };

    const handleEditSet = (set) => {
        setEditingSetId(set._id);
        setQuestions(set.questions);
        setQuestionType(set.type);
        // Scroll to the editor
        document.getElementById('question-editor').scrollIntoView({ behavior: 'smooth' });
    };

    const handleClearValues = async (type) => {
        if (window.confirm(`Are you sure you want to clear ${type}? This cannot be undone.`)) {
            try {
                if (type === 'feedback') await api.delete('/admin/clear-feedback');
                if (type === 'students') await api.delete('/admin/clear-students');
                alert(`${type} cleared successfully.`);
            } catch (error) {
                console.error(error);
                alert(`Failed to clear ${type}`);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 mb-2">
                        Admin Control Panel
                    </h1>
                    <p className="text-gray-400">Manage system data and configurations</p>
                </div>

                {/* Upload Section */}
                <div className="relative group mb-8">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                    <div className="relative bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="text-3xl">📤</div>
                            <div>
                                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                    Data Import
                                </h2>
                                <p className="text-gray-400 text-sm">Upload Excel file containing Students, Faculty, and Subjects sheets</p>
                            </div>
                        </div>

                        {/* Drag & Drop Area */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${dragActive
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-600 hover:border-blue-500/50'
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />

                            {file ? (
                                <div className="space-y-4">
                                    <div className="text-5xl">📊</div>
                                    <div>
                                        <p className="text-white font-semibold text-lg">{file.name}</p>
                                        <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="text-red-400 hover:text-red-300 text-sm underline"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-5xl">📁</div>
                                    <div>
                                        <p className="text-white font-semibold mb-2">
                                            Drag and drop your Excel file here
                                        </p>
                                        <p className="text-gray-400 text-sm mb-4">or</p>
                                        <label
                                            htmlFor="file-upload"
                                            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-lg cursor-pointer hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-blue-500/50"
                                        >
                                            Browse Files
                                        </label>
                                    </div>
                                    <p className="text-gray-500 text-xs">Supported formats: .xlsx, .xls</p>
                                </div>
                            )}
                        </div>

                        {/* Upload Button */}
                        {file && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-lg shadow-lg hover:shadow-blue-500/50 hover:scale-105 transform transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    {uploading ? (
                                        <span className="flex items-center gap-3">
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Uploading...
                                        </span>
                                    ) : (
                                        'Upload Data'
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Message */}
                        {message && (
                            <div className={`mt-6 p-4 rounded-lg ${message.type === 'success'
                                ? 'bg-green-500/10 border border-green-500/50 text-green-200'
                                : 'bg-red-500/10 border border-red-500/50 text-red-200'
                                }`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                </div>

                {/* Question Repository */}
                <div className="relative group mb-8">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                    <div className="relative bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="text-3xl">📚</div>
                            <div>
                                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                    Question Repository
                                </h2>
                                <p className="text-gray-400 text-sm">View, edit, or delete existing question sets</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {existingSets.length === 0 ? (
                                <p className="text-gray-500 italic text-center py-8">No question sets found.</p>
                            ) : (
                                existingSets.map((set) => (
                                    <div key={set._id} className="bg-[#1e293b]/50 border border-white/5 p-5 rounded-xl hover:bg-[#1e293b] transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${set.type === 'theory'
                                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    }`}>
                                                    {set.type}
                                                </span>
                                                {set.isActive && (
                                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-[10px] font-black uppercase animate-pulse">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {!set.isActive && (
                                                    <button
                                                        onClick={() => handleActivateSet(set._id)}
                                                        className="px-3 py-1 text-[10px] font-black uppercase text-green-400 hover:bg-green-500/10 rounded-lg border border-green-500/20 transition-all"
                                                    >
                                                        Activate
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditSet(set)}
                                                    className="px-3 py-1 text-[10px] font-black uppercase text-blue-400 hover:bg-blue-500/10 rounded-lg border border-blue-500/20 transition-all"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSet(set._id)}
                                                    className="px-3 py-1 text-[10px] font-black uppercase text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-all"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-gray-400 text-sm">
                                            <span className="font-bold text-gray-200">{set.questions.length}</span> questions
                                            <span className="mx-2">•</span>
                                            Created: {new Date(set.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Question Management */}
                <div id="question-editor" className="relative group mb-8 scroll-mt-6">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                    <div className="relative bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="text-3xl">❓</div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                    {editingSetId ? 'Edit Question Set' : 'Manage Feedback Questions'}
                                </h2>
                                <p className="text-gray-400 text-sm">{editingSetId ? 'Update the selected question set' : 'Create and manage question sets for feedback forms'}</p>
                            </div>
                            {editingSetId && (
                                <button
                                    onClick={() => { setEditingSetId(null); setQuestions([]); }}
                                    className="px-4 py-2 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all"
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>

                        {/* Question Type Selector */}
                        <div className="mb-6">
                            <label className="block text-gray-300 text-sm font-bold mb-3 uppercase tracking-wide">
                                Question Type
                            </label>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setQuestionType('theory')}
                                    className={`flex-1 py-3 rounded-lg font-bold transition-all duration-200 ${questionType === 'theory'
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                        : 'bg-[#1e293b]/50 text-gray-400 hover:bg-[#1e293b]'
                                        }`}
                                >
                                    Theory
                                </button>
                                <button
                                    onClick={() => setQuestionType('lab')}
                                    className={`flex-1 py-3 rounded-lg font-bold transition-all duration-200 ${questionType === 'lab'
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                        : 'bg-[#1e293b]/50 text-gray-400 hover:bg-[#1e293b]'
                                        }`}
                                >
                                    Lab
                                </button>
                            </div>
                        </div>

                        {/* Add Question Input */}
                        <div className="flex gap-3 mb-6">
                            <input
                                type="text"
                                value={questionText}
                                onChange={(e) => setQuestionText(e.target.value)}
                                placeholder="Enter question text..."
                                className="flex-1 bg-[#1e293b]/50 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all placeholder-gray-600"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddQuestion()}
                            />
                            <button
                                onClick={handleAddQuestion}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-purple-500/50"
                            >
                                Add
                            </button>
                        </div>

                        {/* Questions List */}
                        <div className="bg-[#1e293b]/30 rounded-lg p-4 mb-6 max-h-60 overflow-y-auto">
                            {questions.length === 0 ? (
                                <p className="text-gray-500 italic text-center py-8">No questions added yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {questions.map((q, idx) => (
                                        <li key={idx} className="flex items-start gap-3 bg-[#0f172a]/50 p-3 rounded-lg group hover:bg-[#0f172a] transition-all">
                                            <span className="text-purple-400 font-bold min-w-[30px]">{idx + 1}.</span>
                                            <span className="text-gray-300 flex-1">{q}</span>
                                            <button
                                                onClick={() => handleRemoveQuestion(idx)}
                                                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                ✕
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSaveQuestions}
                            disabled={questions.length === 0}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02] transform transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {editingSetId ? 'Update Question Set' : 'Save & Activate Question Set'}
                        </button>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                    <div className="relative bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-2xl border border-red-500/20">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="text-3xl">⚠️</div>
                            <div>
                                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400">
                                    Danger Zone
                                </h2>
                                <p className="text-gray-400 text-sm">Irreversible actions - proceed with caution</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => handleClearValues('feedback')}
                                className="py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-lg hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-red-500/50"
                            >
                                Clear All Feedback
                            </button>
                            <button
                                onClick={() => handleClearValues('students')}
                                className="py-4 bg-gradient-to-r from-red-700 to-red-800 text-white font-bold rounded-lg hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-red-500/50"
                            >
                                Clear Students & Feedback
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
