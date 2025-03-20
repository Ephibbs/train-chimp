"use client";

import Link from "next/link";
import { SignInForm } from "@/components/auth/signin-form";

export default function SignIn() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Sign in to TrainChimp</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your AI fine-tuning workspace
          </p>
        </div>
        
        <SignInForm />
        
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 