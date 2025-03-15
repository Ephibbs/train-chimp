import Link from "next/link";
import { getProviders } from "next-auth/react";
import { SignInForm } from "@/components/auth/signin-form";

export default async function SignIn() {
  const providers = await getProviders();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center">
            <span className="text-4xl">🐵</span>
            <span className="ml-2 text-2xl font-bold">TrainChimp</span>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold">Sign in to your account</h2>
          <p className="mt-2 text-sm">
            Or{" "}
            <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">
              create an account if you don't have one
            </Link>
          </p>
        </div>
        
        <SignInForm providers={providers} />
      </div>
    </div>
  );
} 