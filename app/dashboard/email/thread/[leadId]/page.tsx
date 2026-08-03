"use client";

import { use } from "react";
import { EmailChatDetail } from "@/components/dashboard/email-chat-detail";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailThreadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
    const { leadId } = use(params);
    const decodedLeadId = decodeURIComponent(leadId);

    return (
        <div className="flex-1 w-full h-[88vh] flex flex-col p-4 sm:p-6">
            <div className="mb-4">
                <Link href="/dashboard/email/sent">
                    <Button variant="ghost" size="sm" className="gap-2 text-slate-300 hover:text-white">
                        <ChevronLeft className="h-4 w-4" /> Back to Email Dashboard
                    </Button>
                </Link>
            </div>
            <div className="flex-1 overflow-hidden">
                <EmailChatDetail leadId={decodedLeadId} />
            </div>
        </div>
    );
}
