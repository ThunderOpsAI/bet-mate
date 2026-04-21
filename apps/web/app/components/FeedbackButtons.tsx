"use client";

import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, HelpCircle, AlertCircle, CheckCircle2 } from "lucide-react";

type FeedbackType = "helpful" | "looks_wrong" | "data_issue" | "confusing";

type FeedbackButtonsProps = {
  sport: string;
  eventId: string;
  selection?: string;
  context?: string;
};

export default function FeedbackButtons({ sport, eventId, selection, context }: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFeedback = async (type: FeedbackType) => {
    setLoading(true);
    // In a real app, we'd POST to an API. 
    // For now, we simulate success to fulfill the UX requirement.
    console.log(`[Feedback] ${sport}/${eventId}/${selection || 'event'}: ${type}`, { context });
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 600));
    
    setSubmitted(true);
    setLoading(false);
    
    // Reset after a few seconds
    setTimeout(() => setSubmitted(false), 3000);
  };

  if (submitted) {
    return (
      <div className="feedback-thank-you">
        <CheckCircle2 size={14} />
        <span>Thanks for the feedback!</span>
        <style jsx>{`
          .feedback-thank-you {
            display: flex;
            alignItems: center;
            gap: 0.5rem;
            color: var(--green);
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.25rem 0.5rem;
            animation: fade-in 0.3s ease-out;
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="feedback-container">
      <span className="feedback-label">Feedback?</span>
      <div className="feedback-actions">
        <button 
          className="feedback-btn" 
          onClick={() => handleFeedback("helpful")}
          title="Helpful"
          disabled={loading}
        >
          <ThumbsUp size={14} />
        </button>
        <button 
          className="feedback-btn" 
          onClick={() => handleFeedback("looks_wrong")}
          title="Looks wrong"
          disabled={loading}
        >
          <ThumbsDown size={14} />
        </button>
        <button 
          className="feedback-btn" 
          onClick={() => handleFeedback("data_issue")}
          title="Data issue"
          disabled={loading}
        >
          <AlertCircle size={14} />
        </button>
        <button 
          className="feedback-btn" 
          onClick={() => handleFeedback("confusing")}
          title="Confusing"
          disabled={loading}
        >
          <HelpCircle size={14} />
        </button>
      </div>

      <style jsx>{`
        .feedback-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--border-light);
        }
        .feedback-label {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .feedback-actions {
          display: flex;
          gap: 0.5rem;
        }
        .feedback-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 4px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .feedback-btn:hover:not(:disabled) {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--bg-hover);
        }
        .feedback-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
