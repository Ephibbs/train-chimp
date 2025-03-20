"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function VerifyEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <Link href="/" className="inline-flex items-center">
            <span className="text-4xl">🐵</span>
            <span className="ml-2 text-2xl font-bold">TrainChimp</span>
          </Link>
          <div className="flex items-center justify-center mt-6">
            <AlertCircle className="h-12 w-12 text-blue-500" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold">Check your email</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            We've sent you a confirmation email. Please check your inbox and click the verification link to complete your registration.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Link 
            href="/auth/signin"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Return to sign in
          </Link>
          <Link 
            href="/"
            className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Return to home page
          </Link>
        </div>
      </div>
    </div>
  );
} 