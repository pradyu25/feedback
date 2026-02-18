import { useState, useEffect } from 'react';
import api from '../utils/axios';
import { FaCloudUploadAlt, FaTrash, FaEdit, FaCheckCircle, FaExclamationTriangle, FaList, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
    const [activeSection, setActiveSection] = useState('import'); // import, questions, danger

    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

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
                setMessage({ type: 'error', text: 'Please upload an Excel file (.xlsx or .xls)' });
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
        setActiveSection('questions');
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

    const scrollToSection = (id) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-gray-50 flex font-['Outfit']">
            {/* Sidebar */}
            <aside className="w-72 bg-[#0f172a] text-white flex flex-col p-8 fixed h-full z-10 hidden md:flex">
                <div className="mb-12">
                    <div className="flex items-center gap-3 text-white mb-2">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-black text-xl">
                            A
                        </div>
                        <span className="font-bold text-xl tracking-tight">Admin Console</span>
                    </div>
                    <p className="text-gray-400 text-sm ml-14">System Management</p>
                </div>

                <nav className="space-y-4">
                    <button
                        onClick={() => scrollToSection('import')}
                        className={`w-full text-left px-6 py-4 rounded-xl font-bold transition-all ${activeSection === 'import' ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <div className="flex items-center gap-3">
                            <FaCloudUploadAlt /> Data Import
                        </div>
                    </button>
                    <button
                        onClick={() => scrollToSection('questions')}
                        className={`w-full text-left px-6 py-4 rounded-xl font-bold transition-all ${activeSection === 'questions' ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <div className="flex items-center gap-3">
                            <FaList /> Questions
                        </div>
                    </button>
                    <button
                        onClick={() => scrollToSection('danger')}
                        className={`w-full text-left px-6 py-4 rounded-xl font-bold transition-all ${activeSection === 'danger' ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <div className="flex items-center gap-3">
                            <FaExclamationTriangle /> Danger Zone
                        </div>
                    </button>
                </nav>

                <div className="mt-auto">
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
            <main className="flex-1 md:ml-72 p-8 md:p-12">
                <div className="max-w-5xl mx-auto space-y-12">

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-black text-gray-900 mb-2">Control Panel</h1>
                        <p className="text-gray-500 text-lg">Manage users, data, and system configurations.</p>
                    </div>

                    {/* Import Section */}
                    <section id="import" className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl">
                                <FaCloudUploadAlt />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Data Import</h2>
                                <p className="text-gray-500">Upload 'Alloc' files (Subjects/Faculty) or 'Attendance' files (Students). Also supports standard template.</p>
                            </div>
                        </div>

                        <div
                            className={`border-4 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${dragActive ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('file-upload').click()}
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
                                    <div className="text-5xl">📄</div>
                                    <div>
                                        <p className="text-gray-900 font-bold text-lg">{file.name}</p>
                                        <p className="text-gray-400 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                        className="text-red-500 font-bold hover:underline text-sm"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 text-gray-400">
                                    <div className="text-5xl mb-4 text-gray-300">📂</div>
                                    <p className="font-bold text-lg">Click to upload or drag and drop</p>
                                    <p className="text-sm">Excel files only</p>
                                </div>
                            )}
                        </div>

                        {message && (
                            <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 font-bold ${message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                {message.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
                                {message.text}
                            </div>
                        )}

                        {file && (
                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="px-8 py-4 bg-black text-white font-black rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-black/20"
                                >
                                    {uploading ? 'Processing...' : 'Upload Data'}
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Question Repository Section */}
                    <section id="questions" className="space-y-8">
                        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center text-xl">
                                    <FaList />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900">Question Repository</h2>
                                    <p className="text-gray-500">Manage existing feedback questions.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {existingSets.length === 0 ? (
                                    <p className="text-gray-400 italic">No question sets found.</p>
                                ) : (
                                    existingSets.map((set) => (
                                        <div key={set._id} className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all bg-gray-50 group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex gap-2">
                                                    <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-600">
                                                        {set.type}
                                                    </span>
                                                    {set.isActive && (
                                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    {!set.isActive && (
                                                        <button onClick={() => handleActivateSet(set._id)} className="p-2 hover:bg-green-100 text-green-600 rounded-lg" title="Activate">
                                                            <FaCheckCircle />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleEditSet(set)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg" title="Edit">
                                                        <FaEdit />
                                                    </button>
                                                    <button onClick={() => handleDeleteSet(set._id)} className="p-2 hover:bg-red-100 text-red-600 rounded-lg" title="Delete">
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-gray-900 font-bold text-2xl">{set.questions.length} Questions</p>
                                            <p className="text-gray-400 text-sm mt-1">Created: {new Date(set.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Editor */}
                        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-black text-gray-900">
                                    {editingSetId ? 'Edit Question Set' : 'Create New Set'}
                                </h2>
                                {editingSetId && (
                                    <button
                                        onClick={() => { setEditingSetId(null); setQuestions([]); setQuestionText(''); }}
                                        className="text-red-500 font-bold hover:underline"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Type</label>
                                    <div className="flex gap-4">
                                        {['theory', 'lab'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setQuestionType(type)}
                                                className={`flex-1 py-4 rounded-xl font-bold uppercase tracking-widest transition-all ${questionType === type ? 'bg-black text-white shadow-xl shadow-black/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Questions</label>
                                    <div className="flex gap-3 mb-4">
                                        <input
                                            type="text"
                                            value={questionText}
                                            onChange={(e) => setQuestionText(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddQuestion()}
                                            placeholder="Type question here..."
                                            className="flex-1 bg-gray-50 border-gray-200 rounded-xl px-6 py-4 font-medium focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                                        />
                                        <button
                                            onClick={handleAddQuestion}
                                            className="px-8 bg-black text-white font-bold rounded-xl hover:bg-gray-800"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    <ul className="space-y-3">
                                        {questions.map((q, idx) => (
                                            <li key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                                                <div className="flex items-center gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                                                    <span className="font-medium text-gray-700">{q}</span>
                                                </div>
                                                <button onClick={() => handleRemoveQuestion(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <FaTrash className="text-sm" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <button
                                    onClick={handleSaveQuestions}
                                    disabled={questions.length === 0}
                                    className="w-full py-4 bg-black text-white font-black uppercase tracking-widest rounded-xl hover:bg-gray-900 transition-all shadow-xl shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingSetId ? 'Update Set' : 'Save & Activate'}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section id="danger" className="bg-red-50 rounded-3xl p-8 border border-red-100">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center text-xl">
                                <FaExclamationTriangle />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-red-900">Danger Zone</h2>
                                <p className="text-red-400">Irreversible system actions.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button
                                onClick={() => handleClearValues('feedback')}
                                className="p-6 bg-white rounded-2xl border border-red-100 hover:border-red-300 transition-all text-left group"
                            >
                                <h3 className="text-red-600 font-bold text-lg mb-1 group-hover:text-red-700">Clear All Feedback</h3>
                                <p className="text-gray-400 text-sm">Removes all feedback submissions but keeps student/faculty data.</p>
                            </button>
                            <button
                                onClick={() => handleClearValues('students')}
                                className="p-6 bg-white rounded-2xl border border-red-100 hover:border-red-300 transition-all text-left group"
                            >
                                <h3 className="text-red-600 font-bold text-lg mb-1 group-hover:text-red-700">Full System Reset</h3>
                                <p className="text-gray-400 text-sm">Removes ALL data: Students, Faculty, Subjects, and Feedback.</p>
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
