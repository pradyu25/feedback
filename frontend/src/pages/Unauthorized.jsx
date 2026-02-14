import { Link } from 'react-router-dom';

const Unauthorized = () => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-aiml-navy text-white">
            <h1 className="text-4xl font-bold mb-4">403 - Unauthorized</h1>
            <p className="mb-8">You do not have permission to view this page.</p>
            <Link to="/login" className="text-aiml-accent hover:underline">
                Return to Login
            </Link>
        </div>
    );
};

export default Unauthorized;
