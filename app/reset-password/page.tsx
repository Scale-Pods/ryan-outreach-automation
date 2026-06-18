'use client';

import { useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, ArrowRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { resetPassword } from '@/app/actions/auth';

export default function ResetPasswordPage() {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [hashError, setHashError] = useState<string | null>(null);
    const router = useRouter();

    const [state, action, isPending] = useActionState(resetPassword, null as any);

    useEffect(() => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const type = params.get('type');
        const token = params.get('access_token');

        if (!token || type !== 'recovery') {
            setHashError('Invalid or expired reset link. Please request a new one.');
        } else {
            setAccessToken(token);
            // Remove the token from the URL bar
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, []);

    useEffect(() => {
        if (state?.success) {
            const t = setTimeout(() => router.push('/'), 3000);
            return () => clearTimeout(t);
        }
    }, [state, router]);

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
            {/* Background glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-64 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

                <div className="p-8 pt-12 space-y-8">
                    {/* Logo */}
                    <div className="flex justify-center">
                        <div className="relative w-40 h-10">
                            <Image src="/logo.png" alt="Lotus Manor" fill className="object-contain" priority />
                        </div>
                    </div>

                    {/* Invalid link */}
                    {hashError && (
                        <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex justify-center">
                                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <XCircle className="h-8 w-8 text-red-400" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-2">Link Invalid</h1>
                                <p className="text-zinc-400 text-sm">{hashError}</p>
                            </div>
                            <Button
                                onClick={() => router.push('/')}
                                className="w-full h-11 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold rounded-xl gap-2 group"
                            >
                                Back to Login
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    )}

                    {/* Success */}
                    {!hashError && state?.success && (
                        <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex justify-center">
                                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-2">Password Updated</h1>
                                <p className="text-zinc-400 text-sm">{state.message}</p>
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Redirecting to login…
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    {!hashError && !state?.success && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            <div className="space-y-2 text-center">
                                <h1 className="text-3xl font-bold tracking-tighter text-white">Set New Password</h1>
                                <p className="text-zinc-400 text-sm">Choose a strong password for your account</p>
                            </div>

                            {state?.error && (
                                <div className="p-3 text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-center">
                                    {state.error}
                                </div>
                            )}

                            <form action={action} className="space-y-4">
                                <input type="hidden" name="accessToken" value={accessToken ?? ''} />

                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">
                                        New Password
                                    </Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            placeholder="••••••••"
                                            required
                                            minLength={8}
                                            autoFocus
                                            className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">
                                        Confirm Password
                                    </Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                                        <Input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type="password"
                                            placeholder="••••••••"
                                            required
                                            className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl transition-all"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isPending || !accessToken}
                                    className="w-full h-11 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all gap-2 group"
                                >
                                    {isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            Update Password
                                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
