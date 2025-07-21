import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const PendingApproval = () => {
  const navigate = useNavigate();

  // Auto-redirect to login after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login", {
        state: {
          message: "Your account is still pending approval. Please try logging in again later.",
        },
      });
    }, 6000); // 6 seconds

    return () => clearTimeout(timer); // Cleanup
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 card animate-slide-up">
        <div className="card-body text-center">
          <h2 className="text-2xl font-bold mb-4 text-center text-gray-900 dark:text-white">
            Account Pending Approval
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Your account is pending admin approval.<br />
            You will be redirected to the login page shortly...
          </p>
          <Link to="/login" className="btn-primary">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
