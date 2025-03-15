"use client";

import { useState } from "react";
import { Send } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm TrainChimp's AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "This is a placeholder response. In a real application, this would come from your API.",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold mb-6">Chat</h2>
      
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-3/4 rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <p>{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-3/4 rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-700">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t dark:border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-md bg-blue-500 text-white disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 