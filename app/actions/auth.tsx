'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, comparePassword } from '@/lib/auth-utils';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-change-this';
const secret = new TextEncoder().encode(JWT_SECRET);

async function getAppUrl() {
    try {
        const headerList = await headers();
        const host = headerList.get('host');
        const proto = headerList.get('x-forwarded-proto') || 'https';
        if (host) {
            const protocol = host.includes('localhost') ? 'http' : proto;
            return `${protocol}://${host}`.replace(/\/$/, '');
        }
    } catch {
        // Fallback if headers fail
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
    }

    return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function login(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Email and password are required' };
    }

    try {
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return { error: 'Invalid email or password' };
        }

        const isPasswordValid = await comparePassword(password, user.password_hash);
        if (!isPasswordValid) {
            return { error: 'Invalid email or password' };
        }

        // Check password age (90 days)
        const passwordChangedAt = user.password_changed_at ? new Date(user.password_changed_at) : new Date(0);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        if (passwordChangedAt < ninetyDaysAgo) {
            return {
                error: 'Your password has expired (90 days). Please use "Forgot Password" to set a new one.',
                requiresReset: true
            };
        }

        const token = await new SignJWT({ userId: user.id, email: user.email })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(secret);

        (await cookies()).set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60,
            path: '/',
        });

        return { success: true };
    } catch (err) {
        console.error('Login error:', err);
        return { error: 'An unexpected error occurred' };
    }
}

export async function signup(prevState: any, formData: FormData) {
    return { error: 'Signup is currently disabled. Please contact an administrator.' };
}

export async function logout() {
    (await cookies()).delete('auth_token');
    return { success: true };
}

export async function forgotPassword(prevState: any, formData: FormData) {
    const email = (formData.get('email') as string)?.toLowerCase().trim();

    if (!email) {
        return { error: 'Email is required' };
    }

    try {
        // Only send email if account exists in the custom users table
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (user) {
            // Check if shadow user already exists in Supabase Auth to avoid 422 (User already registered)
            const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
            const existingAuthUser = authData?.users?.find(u => u.email?.toLowerCase() === email);

            if (!existingAuthUser) {
                await supabaseAdmin.auth.admin.createUser({
                    email,
                    email_confirm: true,
                    password: crypto.randomUUID(),
                });
            }

            const appUrl = await getAppUrl();
            const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
                redirectTo: `${appUrl}/reset-password`,
            });

            if (resetError) {
                console.error('Supabase resetPasswordForEmail error:', resetError);
                if (resetError.status === 429 || resetError.message?.toLowerCase().includes('rate limit') || resetError.message?.toLowerCase().includes('seconds')) {
                    return { error: 'Email rate limit reached. Please wait 60 seconds before requesting another email.' };
                }
                return { error: resetError.message || 'Failed to send reset email. Please try again.' };
            }
        }

        // Always return success — never reveal whether the email exists
        return { success: true };
    } catch (err) {
        console.error('Forgot password error:', err);
        return { error: 'An unexpected error occurred' };
    }
}

export async function resetPassword(prevState: any, formData: FormData) {
    const accessToken = formData.get('accessToken') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!accessToken || !password || !confirmPassword) {
        return { error: 'All fields are required' };
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    if (password.length < 8) {
        return { error: 'Password must be at least 8 characters' };
    }

    try {
        // Verify the Supabase recovery token and get the user's email
        const supabaseAnon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user }, error: tokenError } = await supabaseAnon.auth.getUser(accessToken);

        if (tokenError || !user?.email) {
            return { error: 'Invalid or expired reset link. Please request a new one.' };
        }

        // Update the custom users table
        const passwordHash = await hashPassword(password);
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                password_hash: passwordHash,
                password_changed_at: new Date().toISOString(),
            })
            .eq('email', user.email);

        if (updateError) {
            console.error('Password update error:', updateError);
            return { error: 'Failed to update password. Please try again.' };
        }

        // Synchronize Supabase Auth shadow user's password
        await supabaseAdmin.auth.admin.updateUserById(user.id, { password });

        return { success: true, message: 'Password updated successfully. Redirecting to login…' };
    } catch (err) {
        console.error('Reset password error:', err);
        return { error: 'An unexpected error occurred' };
    }
}
