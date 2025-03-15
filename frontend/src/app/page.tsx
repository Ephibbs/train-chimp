import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-black">
      {/* Navbar */}
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="text-4xl">🐵</span>
          <span className="text-2xl font-bold">TrainChimp</span>
        </div>
        <div className="space-x-4">
          <Link href="/auth/signin" className="px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            Sign In
          </Link>
          <Link 
            href="/auth/signup" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-1/2">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Fine-tune and deploy serverless models
            </h1>
            <p className="text-xl mb-8">
              TrainChimp is an open-source platform for fine-tuning and deploying LoRA models
              with enterprise-grade infrastructure at your fingertips.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/auth/signup" 
                className="px-8 py-3 bg-blue-600 text-white rounded-md text-center hover:bg-blue-700"
              >
                Get Started for Free
              </Link>
              <a 
                href="https://github.com/ephibbs/train-chimp" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-8 py-3 border border-gray-300 dark:border-gray-700 rounded-md text-center hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                View on GitHub
              </a>
            </div>
          </div>
          <div className="md:w-1/2 mt-12 md:mt-0 flex justify-center">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md">
              <div className="text-center mb-6">
                <span className="text-7xl mb-4 inline-block">🐵</span>
                <h2 className="text-2xl font-bold">TrainChimp Cloud</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 text-green-500">✓</div>
                  <p className="ml-3">Industry-leading fine-tuning infrastructure</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 text-green-500">✓</div>
                  <p className="ml-3">Scalable inference endpoints with vLLM</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 text-green-500">✓</div>
                  <p className="ml-3">Efficient data pipelines and analytics</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 text-green-500">✓</div>
                  <p className="ml-3">Open-source and extensible</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
            <div className="text-4xl mb-4">🧠</div>
            <h3 className="text-xl font-bold mb-2">Fine-tuning</h3>
            <p>Easily train custom models with hardware-optimized techniques for optimal results.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2">Inference</h3>
            <p>Deploy optimized inference endpoints at scale with vLLM and dynamic batching.</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">Analytics</h3>
            <p>Monitor performance and gain insights with integrated analytics and visualizations.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-800 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-6 md:mb-0">
              <div className="flex items-center space-x-2">
                <span className="text-3xl">🐵</span>
                <span className="text-xl font-bold">TrainChimp</span>
              </div>
              <p className="mt-2 max-w-md">
                The open-source serverless AI fine-tuning & inference cloud
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-semibold mb-4">Product</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:underline">Features</a></li>
                  <li><a href="#" className="hover:underline">Pricing</a></li>
                  <li><a href="#" className="hover:underline">Documentation</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:underline">About</a></li>
                  <li><a href="#" className="hover:underline">Blog</a></li>
                  <li><a href="#" className="hover:underline">Careers</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Legal</h3>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:underline">Privacy</a></li>
                  <li><a href="#" className="hover:underline">Terms</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
            <p>&copy; {new Date().getFullYear()} TrainChimp. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
