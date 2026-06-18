"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Calculator, Activity, Crown, Search, Info, RefreshCw, Phone, User, MapPin } from "lucide-react";
import { useData } from "@/context/DataContext";
import { format, subDays } from "date-fns";
import { formatDuration } from "@/lib/utils";
import { LMLoader } from "@/components/lm-loader";

import { DateRange } from "react-day-picker";

export default function VoiceCalculatorPage() {
    const { refreshCalls, calls: rawCalls, loadingCalls } = useData();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const [accountFilter, setAccountFilter] = useState("vapi");
    const [calculating, setCalculating] = useState(false);
    const [results, setResults] = useState<{
        totalCost: number;
        agentTotal: number;
        telephonyTotal: number;
        totalDuration: number;
        callCount: number;
        calculatedAt: Date;
    } | null>(null);

    const handleCalculate = async () => {
        if (!dateRange?.from) return;
        setCalculating(true);
        
        try {
            // 1. Fetch fresh calls for the range
            await refreshCalls({
                from: dateRange.from,
                to: dateRange.to || dateRange.from,
                includeElevenLabs: false,
                provider: 'vapi',
                force: true
            });

            // Note: DataContext 'calls' will be updated after refreshCalls finishes.
            // But we need to wait for the state update or use the return value if it had one.
            // Since refreshCalls doesn't return data, we'll use an effect or a slight delay
            // to ensure we process the latest data. 
            // In this app's pattern, we'll just process rawCalls in a follow-up step.
        } catch (err) {
            console.error("Calculation error:", err);
        } finally {
            // We set calculating false in a small timeout to let the DataContext update
            setTimeout(() => setCalculating(false), 800);
        }
    };

    // Use an effect to process the results once calls are loaded/updated after a calculation trigger
    React.useEffect(() => {
        if (!calculating && results === null && rawCalls.length > 0 && !loadingCalls) {
            // This might trigger on mount, which is fine if rawCalls exist.
            // But the user said "dont calculate by default". 
            // So we'll check if results is null AND we just finished a manual calculation.
        }
    }, [rawCalls, loadingCalls, calculating]);

    // Manual trigger for processing
    const processResults = async () => {
        // Apply the same filtering logic as the logs page
        const filteredCalls = rawCalls.filter((call: any) => {
            if (accountFilter === 'vapi') return call.source === 'vapi';
            if (accountFilter === 'vapi-normal') return call.source === 'vapi' && call.vapiAccount === 'normal';
            if (accountFilter === 'vapi-owners') return call.source === 'vapi' && call.vapiAccount === 'owners';
            if (accountFilter === 'open-house') return call.assistantId === '1ef6ea66-0a75-45f5-b025-1743e048dc90';
            return true;
        });

        if (filteredCalls.length === 0) {
            setResults({
                totalCost: 0,
                agentTotal: 0,
                telephonyTotal: 0,
                totalDuration: 0,
                callCount: 0,
                calculatedAt: new Date()
            });
            return;
        }

        setCalculating(true);
        
        // 2. Fetch telephony costs for all fetched calls
        try {
            const res = await fetch('/api/calls/telephony-cost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    calls: filteredCalls.map(c => ({
                        id: c.id,
                        phoneNumber: c.phoneNumber,
                        phone: c.phone,
                        durationSeconds: c.durationSeconds,
                        isInbound: c.isInbound,
                        startedAt: c.startedAt
                    }))
                })
            });
            
            const data = await res.json();
            const telephonyCosts = data.costs || {};

            let agentTotal = 0;
            let telephonyTotal = 0;
            let totalDuration = 0;

            filteredCalls.forEach(call => {
                const tCost = telephonyCosts[call.id];
                const aCost = call.breakdown?.agent || 0;
                totalDuration += (call.durationSeconds || 0);
                
                if (tCost !== undefined && tCost !== -1) {
                    agentTotal += aCost;
                    telephonyTotal += tCost;
                } else if (call.source === 'elevenlabs') {
                    agentTotal += (parseFloat(call.cost.replace('$', '')) || 0);
                } else {
                    const rawTotal = parseFloat(call.cost.replace('$', '')) || 0;
                    agentTotal += aCost;
                    telephonyTotal += Math.max(0, rawTotal - aCost);
                }
            });

            setResults({
                totalCost: agentTotal + telephonyTotal,
                agentTotal,
                telephonyTotal,
                totalDuration,
                callCount: filteredCalls.length,
                calculatedAt: new Date()
            });
        } catch (err) {
            console.error("Processing error:", err);
        } finally {
            setCalculating(false);
        }
    };

    // We chain the process after handleCalculate by watching loadingCalls transition from true -> false
    const prevLoadingRef = React.useRef(loadingCalls);
    React.useEffect(() => {
        if (prevLoadingRef.current === true && loadingCalls === false && calculating) {
            processResults();
        }
        prevLoadingRef.current = loadingCalls;
    }, [loadingCalls, calculating]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-200">
                        <Calculator className="h-6 w-6" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Cost Calculator</h1>
                </div>
                <p className="text-slate-500 max-w-2xl">
                    Select a date range and account to calculate detailed telephony and agent costs. 
                    This tool uses real-time rate matching and provider APIs for maximum accuracy.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <Card className="lg:col-span-1 border-slate-200 shadow-sm bg-white h-fit">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Search className="h-4 w-4 text-slate-400" />
                            Configuration
                        </CardTitle>
                        <CardDescription>Specify the parameters for calculation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Range</label>
                            <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account / Provider</label>
                            <Select value={accountFilter} onValueChange={setAccountFilter}>
                                <SelectTrigger className="w-full bg-slate-50 border-slate-200 h-11">
                                    <SelectValue placeholder="Select Account" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vapi">All Vapi Calls</SelectItem>
                                    <SelectItem value="vapi-normal">Normal Calls</SelectItem>
                                    <SelectItem value="vapi-owners">Owner Leads</SelectItem>
                                    <SelectItem value="open-house">🏠 Open House Event</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button 
                            className="w-full h-12 text-md font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-100 gap-2 transition-all active:scale-[0.98]"
                            onClick={handleCalculate}
                            disabled={calculating || !dateRange?.from}
                        >
                            {calculating ? (
                                <>
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                    Calculating...
                                </>
                            ) : (
                                <>
                                    <Activity className="h-5 w-5" />
                                    Calculate Total
                                </>
                            )}
                        </Button>

                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                                <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    <strong>Note:</strong> Calculations may take a few seconds as we synchronize costs with telephony providers for the selected range.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {!results && !calculating && (
                        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 h-[400px] flex flex-col items-center justify-center text-center p-8">
                            <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                                <Calculator className="h-8 w-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-400">Ready to Calculate</h3>
                            <p className="text-slate-400 max-w-xs mt-2">
                                Click the "Calculate Total" button to process voice logs for your selected configuration.
                            </p>
                        </Card>
                    )}

                    {calculating && (
                        <Card className="border-slate-200 bg-white h-[400px] flex flex-col items-center justify-center text-center p-8">
                            <LMLoader />
                            <h3 className="text-lg font-bold text-slate-900 mt-6">Processing Voice Logs</h3>
                            <p className="text-slate-500 max-w-xs mt-2 animate-pulse">
                                Fetching call records and applying telephony rates...
                            </p>
                        </Card>
                    )}

                    {results && !calculating && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="border-slate-200 bg-emerald-50 border-emerald-100 shadow-sm overflow-hidden relative group">
                                    <div className="absolute -right-4 -top-4 text-emerald-100 opacity-50 group-hover:scale-110 transition-transform duration-700">
                                        <Crown className="h-24 w-24" />
                                    </div>
                                    <CardContent className="p-6 relative z-10">
                                        <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest mb-1">Total Cost</p>
                                        <p className="text-3xl font-black text-emerald-700">${results.totalCost.toFixed(2)}</p>
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200 bg-blue-50 border-blue-100 shadow-sm overflow-hidden relative group">
                                    <div className="absolute -right-4 -top-4 text-blue-100 opacity-50 group-hover:scale-110 transition-transform duration-700">
                                        <Activity className="h-24 w-24" />
                                    </div>
                                    <CardContent className="p-6 relative z-10">
                                        <p className="text-[10px] uppercase font-black text-blue-600 tracking-widest mb-1">Agent Cost</p>
                                        <p className="text-3xl font-black text-blue-700">${results.agentTotal.toFixed(2)}</p>
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200 bg-purple-50 border-purple-100 shadow-sm overflow-hidden relative group">
                                    <div className="absolute -right-4 -top-4 text-purple-100 opacity-50 group-hover:scale-110 transition-transform duration-700">
                                        <Phone className="h-24 w-24" />
                                    </div>
                                    <CardContent className="p-6 relative z-10">
                                        <p className="text-[10px] uppercase font-black text-purple-600 tracking-widest mb-1">Telephony</p>
                                        <p className="text-3xl font-black text-purple-700">${results.telephonyTotal.toFixed(2)}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                <CardHeader className="bg-slate-50 border-b border-slate-100">
                                    <CardTitle className="text-sm flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-slate-400" />
                                            Detailed Metrics
                                        </span>
                                        <Badge variant="outline" className="bg-white text-slate-500 font-medium border-slate-200">
                                            Calculated at {format(results.calculatedAt, 'p')}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-100">
                                        <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                                                    <Phone className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">Total Calls Processed</p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Successfully Fetched</p>
                                                </div>
                                            </div>
                                            <p className="text-lg font-black text-slate-900">{results.callCount}</p>
                                        </div>

                                        <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                                                    <Activity className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">Total Talk Time</p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cumulative Duration</p>
                                                </div>
                                            </div>
                                            <p className="text-lg font-black text-slate-900">{formatDuration(results.totalDuration)}</p>
                                        </div>

                                        <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
                                                    <Crown className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">Average Cost Per Call</p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Estimated Average</p>
                                                </div>
                                            </div>
                                            <p className="text-lg font-black text-slate-900">
                                                ${(results.callCount > 0 ? results.totalCost / results.callCount : 0).toFixed(3)}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-center pt-4">
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-100 px-4 py-2 rounded-full font-medium">
                                    <Info className="h-3 w-3" />
                                    Prices include per-minute rounding and special backup rates for UAE destinations.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
