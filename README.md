# 2D-Animation-AI
 This project enables users to generate educational 2D animations through AI-powered code generation, supporting two popular animation libraries:

System Architecture
 <img width="1199" height="556" alt="Screenshot 2025-10-30 at 3 43 32 PM" src="https://github.com/user-attachments/assets/dc458f92-4150-4812-afd6-6b594233a1f4" />


# Key Features
1. Dual Library Support

Manim (v0.19.0): Mathematical visualizations, physics simulations, data plots
P5.js: Interactive graphics, generative art, creative coding experiments

2. Intelligent Code Generation

LLM generates library-specific, executable code from natural language
Automatic API version compatibility checking
Fixes common LLM hallucinations (non-existent methods, wrong parameters)

3. Robust Execution Pipeline

Manim: Isolated Python virtual environments prevent dependency conflicts
P5.js: Sandboxed browser execution with Puppeteer-based video capture
Real-time error handling with user-friendly messages

4. Production-Ready Output

Manim animations exported as high-quality MP4 videos
P5.js sketches recorded with configurable frame rates
Instant preview before download

few demo are here [https://drive.google.com/drive/folders/1CcXioKwu-FHHupI_27LDgkmPqKKMvjHn?usp=sharing]

