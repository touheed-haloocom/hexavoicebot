import { useState } from "react";

function GeminiDemo() {
  const [response, setResponse] = useState("");
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const callGemini = async () => {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Write a one-line greeting from Hexa AI" }] }],
        }),
      }
    );

    const data = await res.json();
    setResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "No response");
  };

  return (
    <div className="p-4">
      <button
        onClick={callGemini}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
      >
        Ask Gemini
      </button>
      <p className="mt-4 text-lg">{response}</p>
    </div>
  );
}

export default GeminiDemo;
