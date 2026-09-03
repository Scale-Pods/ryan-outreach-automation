"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, UserCheck } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface FollowUpBossButtonProps {
    leadId?: string | number | null;
    lead?: any;
    variant?: "button" | "icon" | "badge";
    size?: "default" | "sm" | "xs";
    className?: string;
}

export function extractLeadId(leadId?: string | number | null, lead?: any): string | null {
    if (leadId !== undefined && leadId !== null && String(leadId).trim() !== "") {
        return String(leadId).trim();
    }
    if (lead) {
        const candidate =
            lead.lead_id ||
            lead.leadId ||
            lead["Lead ID"] ||
            lead["lead_id"] ||
            lead.id;
        if (candidate !== undefined && candidate !== null && String(candidate).trim() !== "") {
            return String(candidate).trim();
        }
    }
    return null;
}

export function FollowUpBossButton({
    leadId,
    lead,
    variant = "button",
    size = "sm",
    className = "",
}: FollowUpBossButtonProps) {
    const resolvedLeadId = extractLeadId(leadId, lead);
    const targetUrl = resolvedLeadId
        ? `https://napleshomes2.followupboss.com/2/people/view/${encodeURIComponent(resolvedLeadId)}`
        : null;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (targetUrl) {
            window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
    };

    if (!resolvedLeadId || !targetUrl) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span onClick={(e) => e.stopPropagation()} className="inline-block cursor-not-allowed opacity-50">
                            {variant === "icon" ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className={`h-7 w-7 p-0 rounded-md border border-white/10 text-slate-400 ${className}`}
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                            ) : variant === "badge" ? (
                                <Badge variant="outline" className={`text-[10px] opacity-60 border-slate-700 text-slate-400 ${className}`}>
                                    FUB N/A
                                </Badge>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className={`h-7 px-2 text-[11px] font-medium gap-1 text-slate-400 border-white/10 ${className}`}
                                >
                                    <UserCheck className="h-3 w-3" />
                                    FUB
                                </Button>
                            )}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-slate-900 text-slate-300 text-xs border border-slate-700">
                        No Lead ID available
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (variant === "icon") {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClick}
                            className={`h-7 w-7 p-0 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/20 transition-all ${className}`}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-slate-900 text-white text-xs border border-blue-500/30">
                        Open in Follow Up Boss (#{resolvedLeadId})
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (variant === "badge") {
        return (
            <Badge
                onClick={handleClick}
                variant="outline"
                className={`cursor-pointer bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300 transition-all text-[11px] font-medium px-2 py-0.5 gap-1 inline-flex items-center ${className}`}
                title={`Open Follow Up Boss Lead #${resolvedLeadId}`}
            >
                <span>FUB</span>
                <ExternalLink className="h-2.5 w-2.5" />
            </Badge>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            className={`h-7 px-2 text-[11px] font-semibold gap-1.5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-400 hover:text-blue-300 hover:from-blue-600/30 hover:to-indigo-600/30 border border-blue-500/30 rounded-md transition-all shadow-sm ${className}`}
            title={`Open Follow Up Boss Lead #${resolvedLeadId}`}
        >
            <UserCheck className="h-3.5 w-3.5 text-blue-400" />
            <span>FUB</span>
            <ExternalLink className="h-3 w-3 text-blue-400/70" />
        </Button>
    );
}
