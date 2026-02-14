import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelection from './pages/RoleSelection';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import FeedbackForm from './pages/FeedbackForm';
import HodDashboard from './pages/HodDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Unauthorized from './pages/Unauthorized';
import ProtectedRoute from './components/ProtectedRoute'; // Assuming path
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout'; // Simple wrapper

const App = () => {
    return (
        <AuthProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <div className="bg-aiml-navy min-h-screen">
                    <Routes>
                        <Route path="/" element={<RoleSelection />} />
                        <Route path="/login/:role" element={<Login />} />
                        <Route path="/unauthorized" element={<Unauthorized />} />

                        {/* Student Routes */}
                        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                            <Route element={<Layout />}>
                                <Route path="/student/dashboard" element={<StudentDashboard />} />
                                <Route path="/student/feedback/:subjectId" element={<FeedbackForm />} />
                            </Route>
                        </Route>

                        {/* HOD Routes */}
                        <Route element={<ProtectedRoute allowedRoles={['hod']} />}>
                            <Route element={<Layout />}>
                                <Route path="/hod/dashboard" element={<HodDashboard />} />
                            </Route>
                        </Route>

                        {/* Admin Routes */}
                        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                            <Route element={<Layout />}>
                                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </BrowserRouter>
        </AuthProvider>
    );
};

export default App;
