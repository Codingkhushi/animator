import "dotenv/config";
import Groq from 'groq-sdk/index.mjs';

// Fix Manim LaTeX path
process.env["MANIM_TEX_COMPILER"] = "/Library/TeX/texbin/latex";
process.env["MANIM_DVISVGM"] = "/Library/TeX/texbin/dvisvgm"; 

const groq = new Groq({
    apiKey : process.env.GROQ_API_KEY,
});

async function planContent(prompt,library){
    const planningPrompt = `Create an educational story arc for: ${prompt}

Structure as a teaching narrative:

HOOK (Why should I care?):
- What problem does this concept solve?
- What's the "aha moment" learners should have?

CONTEXT (What do I need to know first?):
- What simpler concepts build up to this?
- What analogy helps bridge to this idea?

REVELATION (The core insight):
- What's the key mechanism that makes this work?
- What distinguishes this from similar concepts?

DEMONSTRATION (Show me it working):
- Concrete example with clear cause-and-effect
- Visual metaphors that stick

SIGNIFICANCE (Why does this matter?):
- What can you do with this that you couldn't before?
- How does this connect to bigger ideas?

Return JSON with these story elements filled in.`;

    const response =  await groq.chat.completions.create({
            model : "openai/gpt-oss-120b",
            messages : [{role : "user", content : planningPrompt}]
    });
    try {
        return JSON.parse(response.choices[0].message.content);
    }catch{
        return {
            HOOK: prompt,
            CONTEXT: "Basic context",
            REVELATION: "Key insight",
            DEMONSTRATION: "Example demonstration", 
            SIGNIFICANCE: "Why this matters",
            steps: [prompt],
            duration : 12
        };
    }
}

async function generateReliableCode(step,library,stepIndex,totalSteps){
    let instruction;

    if(library === 'p5'){
        instruction = `Generate P5.js code for this single educational step:
"${step}"

RELIABILITY REQUIREMENTS:
- Use createCanvas(800, 600)
- Use visible colors only (no alpha < 100)
- Draw within canvas bounds (0-800, 0-600)
- Include background() call
- Test basic structure:

function setup() {
    createCanvas(800, 600);
    background(240, 240, 250);
}

function draw() {
    // Simple, working animation
}

Return only working P5.js code. No comments or explanations.`;
    }else{
        instruction = `Generate Manim code for this single educational step with Manim Community v0.19.0:
"${step}"

MANIM COMMUNITY v0.19.0 API REFERENCE (CRITICAL - FOLLOW EXACTLY):

Axes Constructor:
- Axes(x_range, y_range, x_length=12, y_length=6, axis_config=None, x_axis_config=None, y_axis_config=None, tips=True, **kwargs)
- NEVER use 'height' or 'width' as parameters
- Use x_length and y_length instead

Text Constructor:
- Text(text, fill_opacity=1.0, stroke_width=0, color=None, font_size=48, line_spacing=-1, font='', slant='NORMAL', weight='NORMAL', **kwargs)

MathTex Constructor:
- MathTex(*tex_strings, arg_separator=' ', substrings_to_isolate=None, tex_to_color_map=None, tex_environment='align*', **kwargs)

VGroup Constructor:
- VGroup(*vmobjects, **kwargs)

Dot Constructor:
- Dot(point=ORIGIN, radius=0.08, stroke_width=0, fill_opacity=1.0, color=WHITE, **kwargs)

Common Patterns:
✅ CORRECT:
ax = Axes(x_range=[0,5,1], y_range=[0,5,1], x_length=8, y_length=5)
text = Text("Hello", font_size=36)
dot = Dot(radius=0.1, color=RED)

❌ WRONG:
ax = Axes(x_range=[0,5,1], y_range=[0,5,1], height=5, width=8)
text = Text("Hello", size=36)  # Use font_size, not size
dot = Dot(size=0.1)  # Use radius, not size

Sizing:
- Set size in constructor with x_length/y_length for Axes
- Use font_size for Text/MathTex
- Use radius for Dot
- OR use .scale_to_fit_width() / .scale_to_fit_height() after creation
- Don't do both (it's redundant)

ONLY USE THESE EXACT MANIM PATTERNS - NO EXCEPTIONS:
STYLE REQUIREMENTS:
- Only use Modern Manim Community Syntax Only
- Use from manim import * do not import unnessary library"
- Use Text and MathTex for clear labels
- Use Axes, ValueTracker, always_redraw where helpful
- Use animations: Create, FadeIn, FadeOut, Transform, TransformMatchingShapes, Write
- Structure: class MainScene(Scene): def construct(self): ...
- Break down explanation into sequential sub-animations
- Include pauses: self.wait(1-2) after key reveals
- Keep layout clean: title at top, math center, supporting visuals below
- Prefer TransformMatchingShapes for equations
- Must be executable Manim code, no markdown or comments

MANDATORY ELEMENTS (ALWAYS INCLUDE):
- Start your code with:
  title = Text("<short title>", font_size=24).to_edge(UP)
  self.play(Write(title))
- Do NOT create Axes by default. Only use Axes if the step explicitly mentions a graph/plot/axis. Prefer simple primitives (Line, Arrow, NumberLine) for timelines.
- If you DO create Axes (variable named ax), then add labels:
  labels = ax.get_axis_labels(Text("x", font_size=16), Text("y", font_size=16))
  self.play(Write(labels))

PRESENTATION QUALITY REQUIREMENTS (CRITICAL):

Layout and Safety Constraints:
- Keep all content inside the frame. If using camera framing, inherit from MovingCameraScene.
- Add 5-10% padding around all content - never let text/graphs touch frame edges
- Use safe zones: keep content within 80% of frame width and 85% of frame height

Font Size Standards:
- Titles: font_size=24 (consistent across all slides)
- Body text: font_size=18 (consistent across all slides)  
- Captions/labels: font_size=20 (consistent across all slides)
- Equations: font_size=18 (consistent across all slides)
- NEVER exceed font_size=24 for any text

Content Organization:
- Split complex topics into multiple focused slides (one concept per slide)
- Each slide should have maximum 3-4 key elements to avoid overflow
- Use clear visual hierarchy: Title → Main Content → Supporting Elements
- Keep text concise - avoid long explanations on single slides

Sizing and Positioning:
- Axes: Use x_length=8, y_length=5 and position with .to_edge(DOWN, buff=1.5)
- Text: Use .scale_to_fit_width(config.frame_width*0.75) for long text/equations
- All content: Keep within safe margins (5-10% from edges)
- Center important content, use consistent spacing

Slide Structure:
- Slide 1: Introduction/Title (minimal text, clear focus)
- Slide 2: Core concept demonstration
- Slide 3: Key insight or formula
- Slide 4: Application or conclusion
- Use FadeOut/FadeIn between major concept changes


RELIABILITY REQUIREMENTS:
- Include proper imports: from manim import * "do not import unnessary library"
- Do not use unexpected keyword or argument that do not exist
- Use only supported arguments for v0.19.0
- All animations must be listed as positional arguments in self.play()
- Keyword arguments like run_time, rate_func must come after all animations
- Example: self.play(anim1, anim2, run_time=3)
- Keep code simple and working

Modern Manim Community Syntax Only:
- Use \`mobject.animate.method()\` instead of passing methods directly to self.play()
- NEVER use: \`self.play(object.set_value, ...)\`  
- ALWAYS use: \`self.play(object.animate.set_value(...))\`
- For ValueTracker: Use \`self.play(tracker.animate.set_value(new_value))\`
- For movement: Use \`self.play(circle.animate.shift(RIGHT))\`
- For scaling: Use \`self.play(circle.animate.scale(2))\`

Graphing Rules (v0.19.0-safe):
- Use \`Axes\` and \`ax.plot(function, x_range=[min, max])\`
- NEVER use \`ax.get_graph\`
- For tangent lines, compute points via \`ax.i2gp(x, graph)\` and use \`always_redraw\` with a \`ValueTracker\`; do NOT pass \`length=\` to \`get_tangent_line\`
- Style lines via mobject methods (e.g., \`.set_color(BLUE)\`), not animation kwargs

Valid Manim Community Animations (v0.19.0):
- Use \`Create()\` NOT ShowCreation() 
- Use \`Uncreate()\` for reverse creation
- Use \`FadeIn()\`, \`FadeOut()\` - these are correct
- Use \`Transform()\`, \`ReplacementTransform()\`
- Use \`Write()\` for text
- Use \`DrawBorderThenFill()\`
- NEVER use: ShowCreation, ShowIncreasingSubsets, etc. (these are old syntax)
- Avoid Opacity = 0

Disallowed/Banned Patterns:
- \`ax.get_graph\`, \`.get_tangent_line(..., length=...)\`, any \`alpha=\` kwargs
- Passing \`color=\` into Animation constructors; set color on the mobject instead

CODE STRUCTURE : 

from manim import *

class MainScene(Scene):
    def construct(self):
        # Phase 1: Hook
        # [LLM inserts here]

        # Phase 2: Context
        # [LLM inserts here]

        # Phase 3: Revelation
        # [LLM inserts here]

        # Phase 4: Demo
        # [LLM inserts here]

        # Phase 5: Significance
        # [LLM inserts here]

No comments or explanations.`;
    }

    const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages : [{role : "user", content : instruction}]
    });
    return response.choices[0].message.content;
}

export default async function GetLLMResponse(prompt, library = 'manim'){
    try{
         // Stage 1: Plan the content
        const contentPlan = await planContent(prompt,library);
        console.log('Content plan : ',contentPlan);

        // Normalize steps from story arc
        // const steps = [
        //     contentPlan.HOOK,
        //     contentPlan.CONTEXT,
        //     contentPlan.REVELATION,
        //     contentPlan.DEMONSTRATION,
        //     contentPlan.SIGNIFICANCE
        // ].filter(Boolean);

        const steps = [contentPlan.HOOK || prompt];

        // Stage 2: Generate code for the first step (simplified approach)
        // const mainStep = contentPlan.steps[0] || prompt;
        // const code = await generateReliableCode(mainStep,library,0,contentPlan.steps.length);

        const code=[];
        for(let i=0;i<contentPlan.steps.length;i++){
            const stepCodes = await generateReliableCode(steps[i],library,i,steps.length);
            code.push(stepCodes);
        }
        
        return {
            code : code.join("\n\n"),
            duration : contentPlan.duration,
            plan : contentPlan
        };
    }catch(e){
        console.error('Multi-stage generation failed, falling back to simple generation:', e);

        //fallback to basic 
        const simpleInstruction = library === 'p5' 
        ? `Create working P5.js code for: ${prompt}. Use createCanvas(800,600), visible colors, and basic shapes.` 
        : `Generate ONLY executable Python code for: ${prompt}. 
            Use: from manim import *
            Use: class MainScene(Scene): def construct(self):
            NO markdown, NO explanations, NO comments.
            ONLY raw Python code that can execute directly.
            MANDATORY: Start with a title at the top using Text("<short title>", font_size=24).to_edge(UP) and Write(title). If you create Axes (variable named ax), also create axis labels via ax.get_axis_labels(Text("x", font_size=16), Text("y", font_size=16)) and write them.`;


        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages : [{ role : "user",content : simpleInstruction}]
        });
        return {
            code : response.choices[0].message.content,
            duration : 12
        }
            

    }

//     if(library === 'p5'){
//         instruction = `ROLE: You are an expert educational creative coder specializing in interactive learning experiences, data visualization, and conceptual demonstrations using P5.js.

// TASK: Transform the user's educational request into an engaging, pedagogically effective animation.

// USER'S EDUCATIONAL REQUEST: ${prompt}

// CONTENT ENHANCEMENT STRATEGY:
// 1. If prompt is abstract: Create concrete visual metaphors and examples
// 2. If prompt lacks interaction: Add meaningful visual feedback and progression
// 3. If prompt is too simple: Layer in additional educational value
// 4. If prompt is complex: Create clear visual hierarchy and progressive disclosure

// EDUCATIONAL ANIMATION APPROACH:
// Choose optimal duration based on content complexity:
// - Simple concepts (basic shapes, color theory): 8-12 seconds
// - Medium concepts (algorithms, processes): 15-20 seconds  
// - Complex concepts (systems, multi-step processes): 25-35 seconds

// VISUAL LEARNING PRINCIPLES:
// - Use color psychology: Warm colors for energy/action, cool colors for calm/data
// - Apply gestalt principles: Group related elements, use proximity and similarity
// - Create visual flow: Guide attention with motion and contrast
// - Use progressive disclosure: Reveal information in logical sequence
// - Employ visual metaphors: Abstract concepts through familiar imagery

// MANDATORY CODE STRUCTURE:
// /*
// EDUCATIONAL ANIMATION: [Brief description]
// DURATION: [X] seconds
// LEARNING OBJECTIVE: [What should viewers understand?]
// TARGET AUDIENCE: [Age/knowledge level]
// */

// function setup() {
//     createCanvas(1920, 1080);
//     frameRate(60);
    
//     // Define educational parameters
//     const DURATION = [X]; // seconds
//     const TOTAL_FRAMES = DURATION * 60;
    
//     // Initialize educational elements
// }

// function draw() {
//     const DURATION = [X];
//     const TOTAL_FRAMES = DURATION * 60;
//     let progress = constrain(frameCount / TOTAL_FRAMES, 0, 1);
    
//     // Educational Phase Structure:
//     if (progress < 0.2) {
//         // INTRODUCTION: Set context, show title/objective
//         drawIntroduction(progress / 0.2);
//     } else if (progress < 0.8) {
//         // MAIN TEACHING: Core concept demonstration
//         let teachingProgress = (progress - 0.2) / 0.6;
//         demonstrateConcept(teachingProgress);
//     } else {
//         // REINFORCEMENT: Summary, key takeaways
//         let summaryProgress = (progress - 0.8) / 0.2;
//         reinforceLearning(summaryProgress);
//     }
    
//     // Always include educational context
//     drawEducationalContext(progress);
    
//     // Stop at completion
//     if (frameCount >= TOTAL_FRAMES) {
//         noLoop();
//     }
// }

// EDUCATIONAL CONTENT REQUIREMENTS:
// - Always include text labels explaining what's happening
// - Use consistent color coding throughout the animation
// - Show quantitative relationships when applicable
// - Include visual scales, axes, or reference points
// - Demonstrate cause-and-effect relationships clearly
// - Use animation to reveal process over time

// HANDLING INCOMPLETE PROMPTS:
// - If concept mentioned without context: Add relevant background information
// - If visualization requested but method unclear: Choose most pedagogically effective approach
// - If data mentioned without specifics: Create realistic, educational sample data
// - If interaction implied but not detailed: Design meaningful user feedback
// - If audience not specified: Assume general educational audience (high school level)

// VISUAL DESIGN GUIDELINES:
// - High contrast for accessibility
// - Consistent typography (use system fonts)
// - Clear visual hierarchy with size and color
// - Smooth, purposeful animations (no gratuitous effects)
// - Educational color palette: blues for information, greens for correct/positive, reds for important/caution
// - Include visual affordances: arrows, highlights, emphasis

// TECHNICAL REQUIREMENTS:
// - Canvas: 1920x1080 for high quality
// - Frame rate: 60fps for smooth motion
// - Use easing functions for natural movement
// - Include progress indicators where helpful
// - Ensure text readability at all sizes
// - Handle edge cases gracefully

// PEDAGOGICAL TIMING:
// - Allow time for comprehension (don't rush complex ideas)
// - Use repetition for key concepts
// - Build complexity gradually
// - Include pauses at crucial learning moments
// - End with clear summary or call-to-action

// Think like an educational designer: Every visual choice should support learning.
// Make abstract concepts concrete and complex ideas accessible.

// Return only clean JavaScript code with educational comment structure.`;
//     } else {
//         instruction = `ROLE: You are an expert educational animator specializing in mathematics, science, and technical concepts using Manim Community v0.19.0.

// TASK: Transform the user's educational prompt into a complete, pedagogically sound animation.

// USER'S EDUCATIONAL REQUEST: ${prompt}

// CONTENT ANALYSIS REQUIREMENTS:
// 1. If the prompt is vague, infer the educational objective and fill in missing details
// 2. If the prompt is complex, break it down into digestible learning steps
// 3. If the prompt lacks context, add appropriate mathematical/scientific background
// 4. Always assume the audience needs step-by-step explanation

// EDUCATIONAL ANIMATION STRUCTURE:
// Phase 1: Context Setting (20% of animation)
// - Display clear title and learning objective
// - Introduce key concepts or terminology
// - Set up the visual framework

// Phase 2: Step-by-Step Teaching (60% of animation)  
// - Break complex ideas into 3-5 clear steps
// - Use visual metaphors and analogies
// - Show intermediate calculations/reasoning
// - Highlight cause-and-effect relationships

// Phase 3: Synthesis & Application (20% of animation)
// - Summarize key insights
// - Show practical applications or extensions
// - Reinforce main learning points

// SPATIAL ORGANIZATION RULES:
// - Title: Always at .to_edge(UP), font_size=36
// - Main content: Center stage with clear focal points
// - Supporting elements: Use LEFT/RIGHT/UP/DOWN with 2-3 unit spacing
// - Labels: .next_to() with consistent positioning
// - Equations: Center or .to_edge() positions
// - Use VGroup() for complex arrangements

// VISUAL HIERARCHY SYSTEM:
// - Primary concepts: Large, central, bright colors (BLUE, GREEN)
// - Secondary elements: Medium size, positioned around primary
// - Labels/annotations: Small, muted colors, consistent positioning
// - Mathematical notation: Use Text() with clear font_size
// - Color coding: Consistent throughout (RED=important, BLUE=neutral, GREEN=correct)

// PEDAGOGICAL TIMING:
// - Introduction: 2-3 seconds with gentle FadeIn
// - Each teaching step: 2-4 seconds with appropriate wait times
// - Transformations: run_time=2-3 for comprehension
// - Conclusions: 2-3 seconds for retention
// - Use self.wait(1-2) between major concepts

// CODE STRUCTURE REQUIREMENTS:
// from manim import *

// class MainScene(Scene):
//     def construct(self):
//         # Phase 1: Context Setting
//         title = Text("Educational Topic", font_size=36).to_edge(UP)
//         objective = Text("Learning Goal", font_size=24).shift(2*UP)
//         self.play(FadeIn(title), FadeIn(objective))
//         self.wait(2)
        
//         # Phase 2: Step-by-step teaching (3-5 steps)
//         # Each step follows: Setup → Demonstrate → Reinforce pattern
        
//         # Phase 3: Synthesis
//         # Summary and key takeaways

// HANDLING INCOMPLETE PROMPTS:
// - If mathematical concept mentioned but details missing: Add standard examples and notation
// - If scientific process described vaguely: Include necessary background and steps
// - If algorithm mentioned without specifics: Use common input/output examples
// - If diagram requested without dimensions: Use educationally appropriate proportions

// MANIM SYNTAX REQUIREMENTS:
// - Modern syntax only: object.animate.method()
// - Use Create(), FadeIn(), Transform(), Write()
// - Explicit imports: from manim import *
// - Scene class: class MainScene(Scene)
// - No markdown formatting in output
// - Self-contained executable code

// Code Requirements:
// - Generate **a single Python class** that inherits from \`Scene\`.
// - Output **only valid Python code** – no markdown, no comments, and no explanations.
// - Import **all required modules** explicitly (e.g., \`from manim import *\`, \`import numpy as np\`, \`import math\`, etc.). Do not use \`from manim import\` alone.
// - If using \`Text\`, use the parameter \`font_size\` instead of \`scale\`.
// - If scaling is needed, use the \`.scale()\` method **after** an object is created.
// - For dynamic animations, use \`ValueTracker\` and \`always_redraw\` where appropriate.
// - For graphs, use \`Axes\` with \`ax.plot(...)\` and \`ax.get_axis_labels(...)\`.
// - Avoid using \`Tex\` or \`MathTex\` unless LaTeX is supported – prefer \`Text\`.
// - The output must be a **self-contained, executable Manim script**.
// - Ensure the code is **ready to copy into a .py file** and can be run immediately

// Critical Formatting Rules:
// - Do not wrap the code in \`\`\`python or \`\`\` blocks
// - Start directly with importing required libraries or modules 
// - Return ONLY the raw Python code without any markdown formatting, code blocks, or explanations

// Modern Manim Community Syntax Only:
// - Use \`mobject.animate.method()\` instead of passing methods directly to self.play()
// - NEVER use: \`self.play(object.set_value, ...)\`  
// - ALWAYS use: \`self.play(object.animate.set_value(...))\`
// - For ValueTracker: Use \`self.play(tracker.animate.set_value(new_value))\`
// - For movement: Use \`self.play(circle.animate.shift(RIGHT))\`
// - For scaling: Use \`self.play(circle.animate.scale(2))\`

// Valid Manim Community Animations (v0.19.0):
// - Use \`Create()\` NOT ShowCreation() 
// - Use \`Uncreate()\` for reverse creation
// - Use \`FadeIn()\`, \`FadeOut()\` - these are correct
// - Use \`Transform()\`, \`ReplacementTransform()\`
// - Use \`Write()\` for text
// - Use \`DrawBorderThenFill()\`
// - NEVER use: ShowCreation, ShowIncreasingSubsets, etc. (these are old syntax)
// - Avoid Opacity = 0

// Think like a master teacher: Your goal is student understanding, not just visual appeal.
// Every element should serve the learning objective.

// Return only clean Python code without formatting.`;
//     }


}


