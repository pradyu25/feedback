/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'aiml-navy': '#0a192f',
                'aiml-navy-light': '#112240',
                'aiml-silver': '#8892b0',
                'aiml-accent': '#64ffda', // Light cyan/accent (typical for dark themes)
                'purple-accent': '#b39ddb', // Soft purple
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
