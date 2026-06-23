"use client";

import { use, useEffect, useState } from "react";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { useData } from "@/context/DataContext";
import { LMLoader } from "@/components/ryan-loader";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
    const { customerId } = use(params);
    const decodedCustomerId = decodeURIComponent(customerId);
    const { leads, loadingLeads } = useData();
    
    const [foundType, setFoundType] = useState<"lead" | "none" | "searching">("searching");

    useEffect(() => {
        if (loadingLeads) return;

        const searchVal = decodedCustomerId.toLowerCase().trim();
        const searchReplaced = searchVal.replace(/\D/g, '');

        const leadFound = leads.find(l => {
            const lId = String(l.id || "").toLowerCase();
            if (lId === searchVal) return true;
            
            if (l.phone) {
                const lPhoneReplaced = String(l.phone).replace(/\D/g, '');
                if (searchReplaced && lPhoneReplaced === searchReplaced) return true;
            }
            return false;
        });

        if (leadFound) {
            setFoundType("lead");
        } else {
            setFoundType("none");
        }
    }, [decodedCustomerId, leads, loadingLeads]);

    if (loadingLeads || foundType === "searching") {
        return <LMLoader />;
    }

    if (foundType === "none") {
        return (
            <div className="h-screen flex flex-col items-center justify-center space-y-4 text-[var(--label-tertiary)]">
                <MessageSquare className="h-12 w-12 opacity-20" />
                <p className="font-medium">Chat not found</p>
                <Link href="/dashboard/whatsapp/chat">
                    <Button variant="outline" className="gap-2">
                        <ChevronLeft className="h-4 w-4" /> Back to Chats
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full h-full p-6">
            <div className="mb-4">
                <Link href="/dashboard/whatsapp/chat">
                    <Button variant="ghost" size="sm" className="gap-2 text-[var(--label-secondary)] hover:text-[var(--label-primary)]">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </Button>
                </Link>
            </div>
            <WhatsAppChatDetail customerId={decodedCustomerId} />
        </div>
    );
}