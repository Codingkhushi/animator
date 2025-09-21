import Groq from 'groq-sdk/index.mjs';
import "dotenv/config";

const groq = new Groq({
    apiKey : process.env.GROQ_API_KEY,
});

export default async function GetLLMResponse(prompt,library = 'manim'){
    let instruction;

    if(library === 'p5'){
        instruction = `You are a P5.js creative coding expert. Generate artistic animation code for: ${prompt}

            📌 **P5.js Animation Requirements:**
                - Use setup() and draw() functions
                - Canvas size: createCanvas(800, 600)
                - Create smooth, artistic animations using frameCount, sin(), cos()
                - Use beautiful color palettes and gradients
                - Include particle systems, organic motion, or generative patterns
                - Animation should loop seamlessly
                - Use P5.js built-in functions: random(), noise(), map(), lerp()

            📌 **P5.js Artistic Techniques:**
                - Particle systems with physics
                - Organic movement using Perlin noise
                - Beautiful color transitions
                - Geometric patterns and fractals
                - Smooth easing and interpolation
                - Background trails and blending modes

            📌 **Code Structure:**
                \`\`\`javascript
                function setup() {
                    createCanvas(800, 600);
                    // initialization
                }

                function draw() {
                    // animation loop
                }
                \`\`\`

                Return ONLY raw JavaScript code, no markdown blocks.
                Focus on creating visually stunning, artistic animations that showcase P5.js creative capabilities.`;
    }else{
        instruction = `User prompt is generic,will only provide the idea of animation, but lacks details.
                    Your task is to understand the prompt,improvise it,understand what details,concept are required to make the animation out of it.
                    Then use this details and concept to write Python code.
                    You are an expert Python animator working with Manim Community v0.19.0 or newer.
                    Your task is to generate **clean, valid Manim scene code** based on the user's animation idea.

                    🎯 The user's animation idea: ${prompt}

                    📌 Code Requirements:
                   - Generate **a single Python class** that inherits from \`Scene\`.
                    Use Scene class named "MainScene": class MainScene(Scene)


                   - Output **only valid Python code** – no markdown, no comments, and no explanations.


                   - Import **all required modules** explicitly (e.g., \`from manim import *\`, \`import numpy as np\`, \`import math\`, etc.). Do not use \`from manim import\` alone.


                    - If using \`Text\`, use the parameter \`font_size\` instead of \`scale\`.


                    - If scaling is needed, use the \`.scale()\` method **after** an object is created.


                    - For dynamic animations, use \`ValueTracker\` and \`always_redraw\` where appropriate.


                    - For graphs, use \`Axes\` with \`ax.plot(...)\` and \`ax.get_axis_labels(...)\`.


                    - Avoid using \`Tex\` or \`MathTex\` unless LaTeX is supported – prefer \`Text\`.


                    - The output must be a **self-contained, executable Manim script**.


                    - Ensure the code is **ready to copy into a .py file** and can be run immediately

                   📋 **Critical Formatting Rules:**
                    - Do not wrap the code in \`\`\`python or \`\`\` blocks
                    - Start directly with importing required libraries or modules 
                    - Return ONLY the raw Python code without any markdown formatting, code blocks, or explanations

                   📌 **Modern Manim Community Syntax Only:**
                    - Use \`mobject.animate.method()\` instead of passing methods directly to self.play()
                    - NEVER use: \`self.play(object.set_value, ...)\`  
                    - ALWAYS use: \`self.play(object.animate.set_value(...))\`
                    - For ValueTracker: Use \`self.play(tracker.animate.set_value(new_value))\`
                    - For movement: Use \`self.play(circle.animate.shift(RIGHT))\`
                    - For scaling: Use \`self.play(circle.animate.scale(2))\`

                    📌 **Valid Manim Community Animations (v0.19.0):**
                    - Use \`Create()\` NOT ShowCreation() 
                    - Use \`Uncreate()\` for reverse creation
                    - Use \`FadeIn()\`, \`FadeOut()\` - these are correct
                    - Use \`Transform()\`, \`ReplacementTransform()\`
                    - Use \`Write()\` for text
                    - Use \`DrawBorderThenFill()\`
                    - NEVER use: ShowCreation, ShowIncreasingSubsets, etc. (these are old syntax)

                    - Avoid Opacity = 0

                    Think like an engineer. The code must be clean, precise, and immediately executable.`;

    }
    try{
        const output = await groq.chat.completions.create({
            model : "openai/gpt-oss-120b",
            messages : [{role : "user",content : instruction}]

        });
        return output.choices[0].message.content;
    }catch(e){
        console.log('Error calling LLM:',e);
        throw new Error ('Failed to get response from LLM.');
        
    }
}

//groq.chat.completions.create - it generates the next message in a conversation.
// You send in the conversation history as a messages array (system + user + assistant so far).
// Groq returns the model’s next “assistant” message.

//openai/gpt-oss-120b - doing great 
//llama-3.1-8b-instant - making mistakes

