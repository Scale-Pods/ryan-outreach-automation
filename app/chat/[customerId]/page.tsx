"use client";

import { use, useEffect, useState } from "react";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { OwnerChatDetail } from "@/components/dashboard/owner-chat-detail";
import { LMLoader } from "@/components/lm-loader";
import { MessageSquare, Lock } from "lucide-react";

export default function PublicChatPage({ params }: { params: Promise<{ customerId: string }> }) {
    const { customerId } = use(params);
    const decodedId = decodeURIComponent(customerId);
    
    const [results, setResults] = useState<{ lead: any, owner: any } | null>(null);
    const [activeTab, setActiveTab] = useState<"lead" | "owner">("lead");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/public/chat/${encodeURIComponent(decodedId)}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setError("Chat not found");
                    } else {
                        setError("Failed to load chat");
                    }
                    return;
                }
                const json = await res.json();
                setResults(json);
                if (decodedId.startsWith('owner-') && json.owner) {
                    setActiveTab("owner");
                } else if (!json.lead && json.owner) {
                    setActiveTab("owner");
                } else {
                    setActiveTab("lead");
                }
            } catch (err) {
                setError("An error occurred");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [decodedId]);

    if (loading) return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
            <LMLoader />
        </div>
    );

    if (error || !results || (!results.lead && !results.owner)) {
        return (
            <div className="h-screen flex flex-col items-center justify-center space-y-4 text-slate-400 bg-slate-50">
                <MessageSquare className="h-12 w-12 opacity-20" />
                <p className="font-medium text-slate-600">{error || "Chat not found"}</p>
                <p className="text-xs text-slate-400">If you believe this is an error, please contact support.</p>
            </div>
        );
    }

    const hasBoth = results.lead && results.owner;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Locked Header Banner */}
            <div className="bg-slate-900 text-white py-2 px-4 flex items-center justify-center gap-2 text-xs font-medium shrink-0">
                <Lock className="h-3 w-3 text-emerald-400" />
                <span>Secure Chat Viewer • Public Access Restricted to this Chat Only</span>
            </div>

            <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 overflow-hidden flex flex-col">
                {/* Tab Switcher if both exist */}
                {hasBoth && (
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 mb-4 w-fit shadow-sm">
                        <button
                            onClick={() => setActiveTab("lead")}
                            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "lead" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600"}`}
                        >
                            Normal Chat
                        </button>
                        <button
                            onClick={() => setActiveTab("owner")}
                            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "owner" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-600"}`}
                        >
                            Owner Chat
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
                    <div className="flex-1 overflow-hidden p-6">
                        {activeTab === "lead" && results.lead ? (
                            <WhatsAppChatDetail customerId={decodedId} initialLead={results.lead} />
                        ) : results.owner ? (
                            <OwnerChatDetail owner={results.owner} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">
                                Select a chat type to view
                            </div>
                        )}
                    </div>
                </div>
                
            </div>
        </div>
    );
}
