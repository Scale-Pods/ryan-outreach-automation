import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['-apple-system', '"Plus Jakarta Sans"', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
                display: ['-apple-system', '"Plus Jakarta Sans"', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
                rounded: ['ui-rounded', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
                mono: ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                /* Apple System Colours — directly accessible */
                apple: {
                    blue: 'var(--blue)',
                    green: 'var(--green)',
                    indigo: 'var(--indigo)',
                    orange: 'var(--orange)',
                    pink: 'var(--pink)',
                    purple: 'var(--purple)',
                    red: 'var(--red)',
                    teal: 'var(--teal)',
                    yellow: 'var(--yellow)',
                },
                /* Glass surface colours */
                glass: {
                    fill: 'var(--glass-fill)',
                    'fill-hover': 'var(--glass-fill-hover)',
                },
                /* Apple label colours */
                label: {
                    primary: 'var(--label-primary)',
                    secondary: 'var(--label-secondary)',
                    tertiary: 'var(--label-tertiary)',
                    quaternary: 'var(--label-quaternary)',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 4px)',
                sm: 'calc(var(--radius) - 8px)',
            },
            boxShadow: {
                'glass': 'var(--glass-shadow)',
                'glass-hover': 'var(--glass-shadow-hover)',
                'glass-sm': '0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1.0)',
            },
            backdropBlur: {
                'glass': '40px',
            },
            letterSpacing: {
                'apple-heading': '-0.022em',
                'apple-body': '-0.011em',
                'apple-metric': '-0.03em',
            },
            animation: {
                'fade-in': 'fadeIn 280ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards',
                'scale-in': 'scaleIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                'slide-in': 'slideInRight 280ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
};
export default config;
