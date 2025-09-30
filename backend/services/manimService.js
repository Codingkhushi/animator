import { spawn } from "child_process";
import fs from 'fs/promises';
import path from 'path';

function cleanPythonCode(code) {
    // DEBUG: Log what we're receiving
    console.log('=== cleanPythonCode DEBUG ===');
    console.log('Type of code:', typeof code);
    console.log('Is code truthy:', !!code);
    console.log('Code length:', code ? code.length : 'N/A');
    console.log('First 200 chars:', code ? code.substring(0, 200) : 'N/A');
    console.log('=== END DEBUG ===');
    
    if (!code || typeof code !== 'string') {
        console.error('cleanPythonCode received invalid code:', code);
        throw new Error('Invalid Python code received');
    }
    return code
        .replace(/```python\s*/g, '')     // Remove ```python
        .replace(/```\s*/g, '')           // Remove closing ```
        .replace(/^python\s*/gm, '')      // Remove standalone "python" 
        .trim();                          // Remove extra whitespace
}

// Best-effort sanitizer for Manim Community v0.19.0 API compatibility
// - Replace legacy graphing calls with supported ones
// - Strip unsupported kwargs commonly hallucinated by LLMs
// - Avoid changing semantics beyond what is necessary to execute
function sanitizeManimCode(originalCode) {
    let code = originalCode;

    // 1) Replace deprecated/invalid graph API
    //    axes.get_graph(f, ...) -> axes.plot(f, ...)
    code = code.replace(/\.get_graph\s*\(/g, '.plot(');

    // 2) Remove length kwarg from get_tangent_line(..., length=...)
    //    Some versions/mobjects do not accept it; default length is fine
    code = code.replace(/(\.get_tangent_line\s*\([^)]*?),(\s*)length\s*=\s*[^,)]+(\s*[,)])/g, '$1$3');

    // 3) Remove generic alpha=... kwargs (prefer opacity/fill_opacity/stroke_opacity set via setters)
    code = code.replace(/,\s*alpha\s*=\s*[^,)]+/g, '');
    code = code.replace(/\(\s*alpha\s*=\s*[^,)]+\s*\)/g, '()');

    // 4) Strip color= from Animation constructors (Create(..., color=...), FadeIn(..., color=...), etc.)
    //    Animations typically ignore styling kwargs; style mobjects instead
    code = code.replace(/(\b(?:Create|Uncreate|FadeIn|FadeOut|Write|DrawBorderThenFill|Transform|ReplacementTransform)\s*\([^)]*?),(\s*)color\s*=\s*[^,)]+(\s*[,)])/g, '$1$3');

    // 5) Common stray kwargs that cause issues on mobject methods
    //    Remove unknown 'length=' in other contexts as a safety (conservative)
    code = code.replace(/,\s*length\s*=\s*[^,)]+/g, '');

    // 6) Axes API: use x_length for width, but keep height for consistency
    //    Only transform inside Axes(...) argument lists to avoid breaking Rectangle/Square/etc.
    code = code.replace(/Axes\s*\(([^)]*)\)/g, (match, args) => {
        const transformed = args
            .replace(/(?<![A-Za-z0-9_])width\s*=/g, 'x_length=');
        // Keep height as-is for Manim v0.19.0 compatibility
        return `Axes(${transformed})`;
    });

    // 6b) If any set_stroke gained x_length/y_length by mistake, revert to width/height
    code = code.replace(/set_stroke\s*\(([^)]*)\)/g, (m, args) => {
        const fixed = args
            .replace(/(?<![A-Za-z0-9_])x_length\s*=/g, 'width=')
            .replace(/(?<![A-Za-z0-9_])y_length\s*=/g, 'height=');
        return `set_stroke(${fixed})`;
    });

    // 6c) get_riemann_rectangles: replace n=... with dx=... when x_range is [axes.x_range[0], axes.x_range[1]]
    code = code.replace(/get_riemann_rectangles\s*\(([^)]*?)x_range\s*=\s*\[\s*axes\.x_range\[0\]\s*,\s*axes\.x_range\[1\]\s*\]([^)]*?)n\s*=\s*([^,)]+)([^)]*?)\)/g,
        (match, pre, mid, nExpr, post) => {
            const dxExpr = `(axes.x_range[1]-axes.x_range[0])/(${nExpr.trim()})`;
            return `get_riemann_rectangles(${pre}x_range=[axes.x_range[0], axes.x_range[1]]${mid}dx=${dxExpr}${post})`;
        }
    );

    // 6d) Fallback: any remaining ", n=..." to ", dx=..."
    code = code.replace(/,\s*n\s*=\s*/g, ', dx=');

    // 6e) Axes label helper: add_coordinate_labels -> add_coordinates (v0.19.0)
    code = code.replace(/\.add_coordinate_labels\s*\(/g, '.add_coordinates(');

    // 7) Normalize multiple commas that may result from removals (e.g., ", ," -> ",")
    code = code.replace(/,\s*,/g, ', ');
    //    Clean up "(," or ",)" artifacts
    code = code.replace(/\(\s*,/g, '(');
    code = code.replace(/,\s*\)/g, ')');

    // 7b) Fix common hallucination: using j in label formats without defining j
    //     Replace j+1 with i+1 when no j loop is present
    if (!/for\s+j\s+in\s+/.test(code)) {
        code = code.replace(/j\s*\+\s*1/g, 'i+1');
    }

    // 8) Ensure numpy import if np.* is used
    if (/\bnp\./.test(code) && !/import\s+numpy\s+as\s+np/.test(code)) {
        code = `import numpy as np\n` + code;
    }

    // 8b) Normalize common Unicode to LaTeX-safe sequences inside MathTex/Text strings
    //     Simple global replacements are acceptable as code rarely uses these symbols in identifiers
    const unicodeToLatex = [
        [/ŷ|ŷ/g, '\\hat{y}'],
        [/ẑ|ẑ/g, '\\hat{z}'],
        [/x̂/g, '\\hat{x}'],
        [/÷/g, '\\div '],
        [/×/g, '\\times '],
        [/−/g, '-'],
        [/°/g, '^{\\circ}'],
        [/π/g, '\\pi '],
        [/η/g, '\\eta '],
        [/σ/g, '\\sigma '],
        [/θ/g, '\\theta '],
    ];
    for (const [re, rep] of unicodeToLatex) {
        code = code.replace(re, rep);
    }

    // 8c) Normalize config constant name (some models emit CONFIG instead of config)
    code = code.replace(/\bCONFIG\b/g, 'config');

    // 9) Ensure the Scene inherits from MovingCameraScene for camera/frame controls
    code = code.replace(/class\s+MainScene\s*\(\s*Scene\s*\)\s*:/, 'class MainScene(MovingCameraScene):');

    // 9a) Add camera setup for better framing and margins
    code = code.replace(/(def\s+construct\s*\(self\)\s*:\s*)/, ($0) => {
        return `${$0}
        # Setup camera with safe margins (10% padding)
        self.camera.frame.set(width=config.frame_width*0.9, height=config.frame_height*0.9)
        self.camera.frame.move_to(ORIGIN)
`;
    });

    // 9b) CRITICAL: Fix indentation - ensure ALL code after construct() uses exactly 8 spaces
    {
        const lines = code.split('\n');
        const out = [];
        let inConstruct = false;
        let constructIndent = '';
        
        for (const line of lines) {
            if (/def\s+construct\s*\(self\)\s*:\s*/.test(line)) {
                inConstruct = true;
                constructIndent = line.match(/^(\s*)/)[1];
                out.push(line);
                continue;
            }
            
            if (inConstruct) {
                // Check if we're still in construct method (not in a nested class/function)
                const currentIndent = line.match(/^(\s*)/)[1];
                if (currentIndent.length <= constructIndent.length && line.trim() !== '') {
                    inConstruct = false;
                }
                
                // CRITICAL: Force exactly 8 spaces for ALL construct body content
                if (inConstruct) {
                    if (/^\s*$/.test(line)) {
                        // Preserve empty lines with proper indentation
                        out.push(constructIndent + '        ');
                    } else if (/^\s*#/.test(line)) {
                        // Preserve comments with proper indentation
                        const commentText = line.trim();
                        out.push(constructIndent + '        ' + commentText);
                    } else if (line.trim() !== '') {
                        // All other content gets exactly 8 spaces
                        const bodyIndent = constructIndent + '        '; // Exactly 8 spaces
                        const trimmedLine = line.trim();
                        out.push(bodyIndent + trimmedLine);
                    }
                } else {
                    out.push(line);
                }
            } else {
                out.push(line);
            }
        }
        code = out.join('\n');
    }

    // 10) Keep Text/MathTex within frame width only when assigned to a variable
    //     We insert a separate scaling line to avoid chaining onto complex expressions
    {
        const lines = code.split('\n');
        const out = [];
        const assignRe = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(Text|MathTex)\s*\(/;
        for (const line of lines) {
            let currentLine = line;
            // 10a) If Text(...) clearly contains TeX markers, convert to MathTex(...)
            currentLine = currentLine.replace(/\bText\s*\(\s*((?:[rf]|rf|fr)?\s*['"][^'"]*\\[^'"]*['"])\s*(,|\))/g, 'MathTex($1$2');
            // 10b) Replace accidental literal Text("MathTex") with a tiny neutral label
            currentLine = currentLine.replace(/\bText\s*\(\s*['"]\s*MathTex\s*['"](\s*,|\s*\))/g, "Text(' ', font_size=14)$1");
            out.push(currentLine);
            const m = currentLine.match(assignRe);
            const isSingleLineCall = /\)\s*$/.test(currentLine);
            if (m && isSingleLineCall && !/(scale_to_fit_width|set\s*\(\s*width\s*=|\.scale\s*\()/.test(line)) {
                const indent = m[1];
                const varName = m[2];
                const ctor = m[3];
                // REMOVED: .scale_to_fit_width lines - they cause indentation issues
                if (ctor === 'MathTex' && /(eq|formula)/i.test(varName)) {
                    out.push(`${indent}${varName}.set_font_size(24)`);
                    out.push(`${indent}${varName}.to_edge(DOWN)`);
                }
            }
        }
        code = out.join('\n');
    }

    // 11) Enforce consistent, readable font sizes for Text/MathTex
    // 11a) Standardize font sizes: titles=32, body=24, captions=20
    code = code.replace(/font_size\s*=\s*(\d+)/g, (m, val) => {
        const n = parseInt(val, 10);
        const capped = isNaN(n) ? 24 : Math.min(n, 32);
        return `font_size=${capped}`;
    });

    // 11b) Auto-assign font sizes based on context and fix duplicate parameters
    {
        const lines = code.split('\n');
        const out = [];
        for (const line of lines) {
            let newLine = line;
            
            // Fix duplicate font_size parameters - remove ALL duplicates
            newLine = newLine.replace(/font_size\s*=\s*\d+\s*,\s*font_size\s*=\s*\d+/g, (match) => {
                const firstMatch = match.match(/font_size\s*=\s*(\d+)/);
                return firstMatch ? `font_size=${firstMatch[1]}` : match;
            });
            // Also fix multiple consecutive font_size parameters
            newLine = newLine.replace(/(font_size\s*=\s*\d+\s*,?\s*){2,}/g, (match) => {
                const firstMatch = match.match(/font_size\s*=\s*(\d+)/);
                return firstMatch ? `font_size=${firstMatch[1]}` : match;
            });
            
            // Title detection: .to_edge(UP) or contains "title"
            if (/\bText\s*\([^)]*\)(?![^.]*font_size)/.test(newLine) && (/.to_edge\s*\(\s*UP\s*\)/.test(newLine) || /title/i.test(newLine))) {
                newLine = newLine.replace(/\bText\s*\(([^)]*)\)/, 'Text($1, font_size=32)');
            }
            // Caption detection: .to_edge(DOWN) or contains "caption", "label"
            else if (/\b(Text|MathTex)\s*\([^)]*\)(?![^.]*font_size)/.test(newLine) && (/.to_edge\s*\(\s*DOWN\s*\)/.test(newLine) || /(caption|label)/i.test(newLine))) {
                newLine = newLine.replace(/\b(Text|MathTex)\s*\(([^)]*)\)/, '$1($2, font_size=20)');
            }
            // Default body text
            else if (/\b(Text|MathTex)\s*\([^)]*\)(?![^.]*font_size)/.test(newLine)) {
                newLine = newLine.replace(/\b(Text|MathTex)\s*\(([^)]*)\)/, '$1($2, font_size=24)');
            }
            out.push(newLine);
        }
        code = out.join('\n');
    }


    // 12) Standardize layout with safe margins and fix VGroup issues
    {
        const lines = code.split('\n');
        const out = [];
        for (const line of lines) {
            out.push(line);
            
            // Fix VGroup list comprehension issues - REMOVE .move_to() from inside VGroup
            if (/\w+\s*=\s*VGroup\s*\(\s*\*\[.*\.move_to\(ORIGIN\).*\]\s*\)/.test(line)) {
                const varMatch = line.match(/^(\s*)(\w+)\s*=\s*VGroup/);
                if (varMatch) {
                    const indent = varMatch[1];
                    const varName = varMatch[2];
                    // Remove .move_to(ORIGIN) from inside the list comprehension
                    const fixedLine = line.replace(/\.move_to\(ORIGIN\)/g, '');
                    out[out.length - 1] = fixedLine;
                    // DO NOT add .move_to(ORIGIN) as separate line - it breaks VGroup
                }
            }
            
            // Auto-position axes with safe margins
            const axesMatch = line.match(/^(\s*)(\w+)\s*=\s*Axes\s*\([^\)]*\)\s*$/);
            if (axesMatch) {
                const indent = axesMatch[1];
                const name = axesMatch[2];
                out.push(`${indent}${name}.scale_to_fit_height(config.frame_height*0.6)`);
                out.push(`${indent}${name}.to_edge(DOWN, buff=1.5)`);
            }
            
            // Auto-position main content with safe zones (but not VGroups with .move_to already)
            const contentMatch = line.match(/^(\s*)(\w+)\s*=\s*(VGroup|Group)\s*\(/);
            if (contentMatch && !/.to_edge|.move_to|.shift/.test(line) && !/\.move_to\(ORIGIN\)/.test(line)) {
                const indent = contentMatch[1];
                const name = contentMatch[2];
                out.push(`${indent}${name}.move_to(ORIGIN)`);
            }
        }
        code = out.join('\n');
    }

    return code;
}

// MINIMAL SAFE FIXES + PRESENTATION QUALITY ENHANCEMENTS
function applyMinimalSafeFixes(code) {
    let fixedCode = code;
    
    // 1) Only fix critical API compatibility issues
    fixedCode = fixedCode.replace(/\.get_graph\s*\(/g, '.plot(');
    fixedCode = fixedCode.replace(/\bCONFIG\b/g, 'config');
    
    // 2) Fix Unicode characters that break LaTeX
    const unicodeToLatex = [
        [/ŷ|ŷ/g, '\\hat{y}'],
        [/ẑ|ẑ/g, '\\hat{z}'],
        [/x̂/g, '\\hat{x}'],
        [/÷/g, '\\div '],
        [/×/g, '\\times '],
        [/−/g, '-'],
        [/°/g, '^{\\circ}'],
        [/π/g, '\\pi '],
        [/η/g, '\\eta '],
        [/σ/g, '\\sigma '],
        [/θ/g, '\\theta '],
    ];
    for (const [re, rep] of unicodeToLatex) {
        fixedCode = fixedCode.replace(re, rep);
    }
    
    // 3) Ensure numpy import if needed
    if (/\bnp\./.test(fixedCode) && !/import\s+numpy\s+as\s+np/.test(fixedCode)) {
        fixedCode = `import numpy as np\n` + fixedCode;
    }
    
    // 4) Ensure MovingCameraScene for camera operations
    fixedCode = fixedCode.replace(/class\s+MainScene\s*\(\s*Scene\s*\)\s*:/, 'class MainScene(MovingCameraScene):');
    
    // 5) PRESENTATION QUALITY ENHANCEMENTS
    
    // Standardize font sizes for presentation quality (Titles 20pt, others 16pt)
    fixedCode = fixedCode.replace(/font_size\s*=\s*[0-9]+/g, (match) => {
        const size = parseInt(match.match(/[0-9]+/)[0]);
        if (size > 20) return 'font_size=20'; // Hard cap at 20pt
        return match; // Keep smaller sizes as-is
    });

    // Add default font sizes when missing
    // - Titles (Text with .to_edge(UP)) -> 20
    // - All other Text/MathTex -> 16
    fixedCode = fixedCode.replace(/(\b[A-Za-z_][A-Za-z0-9_]*)\s*=\s*Text\(([^)]*)\)/g,
        (match, varName, args) => {
            let newArgs = args;
            if (!/font_size\s*=/.test(args)) {
                newArgs = args + ', font_size=16';
            }
            let rewritten = `${varName} = Text(${newArgs})`;
            const titleRe = new RegExp(`\\b${varName}\\.to_edge\\(\\s*UP`);
            if (titleRe.test(fixedCode)) {
                // Force title size to 20
                rewritten = rewritten.replace(/font_size\s*=\s*\d+/, 'font_size=20');
            }
            return rewritten;
        }
    );

    fixedCode = fixedCode.replace(/(\b[A-Za-z_][A-Za-z0-9_]*)\s*=\s*MathTex\(([^)]*)\)/g,
        (match, varName, args) => {
            let newArgs = args;
            if (!/font_size\s*=/.test(args)) {
                newArgs = args + ', font_size=16';
            }
            return `${varName} = MathTex(${newArgs})`;
        }
    );
    
    // Ensure consistent Axes sizing and positioning
    fixedCode = fixedCode.replace(/Axes\s*\(([^)]*)\)/g, (match, args) => {
        // Add consistent sizing if not present
        if (!/x_length\s*=/.test(args)) {
            args += ', x_length=8';
        }
        if (!/y_length\s*=/.test(args)) {
            args += ', y_length=5';
        }
        return `Axes(${args})`;
    });
    
    // Add safe positioning for Axes if not present
    fixedCode = fixedCode.replace(/(\w+)\s*=\s*Axes\([^)]+\)/g, (match, varName) => {
        if (!fixedCode.includes(`${varName}.to_edge`)) {
            return match + `\n        ${varName}.to_edge(DOWN, buff=1.5)`;
        }
        return match;
    });
    
    // Add safe text scaling for long text/equations
    fixedCode = fixedCode.replace(/(\w+)\s*=\s*(Text|MathTex)\([^)]+\)/g, (match, varName, type) => {
        if (!fixedCode.includes(`${varName}.scale_to_fit_width`)) {
            return match + `\n        ${varName}.scale_to_fit_width(config.frame_width*0.75)`;
        }
        return match;
    });
    
    // THAT'S IT - No indentation changes, no parameter modifications, no line injections
    return fixedCode;
}

function validateAgainstBannedPatterns(code) {
    const banned = [
        /\.get_graph\s*\(/,                 // should have been replaced by .plot(
        /\.get_tangent_line\s*\([^)]*length\s*=/, // tangent with length kwarg
        /\balpha\s*=/,                        // alpha kwarg is unreliable
    ];
    const violations = banned.filter((re) => re.test(code));
    return violations.length === 0;
}

export default async function manimService(result) {
    return new Promise(async (resolve, reject) => {
        try {
            // DEBUG: Log what we're receiving at the start
            console.log('=== manimService DEBUG ===');
            console.log('Type of result:', typeof result);
            console.log('Is result truthy:', !!result);
            console.log('Result keys:', result ? Object.keys(result) : 'N/A');
            console.log('Result.code type:', result && result.code ? typeof result.code : 'N/A');
            console.log('Result.code length:', result && result.code ? result.code.length : 'N/A');
            console.log('First 200 chars of result.code:', result && result.code ? result.code.substring(0, 200) : 'N/A');
            console.log('=== END manimService DEBUG ===');
            
            // Extract the actual Python code from the result object
            const pythonCode = result && result.code ? result.code : result;
            
            if (!pythonCode || typeof pythonCode !== 'string') {
                console.error('manimService received invalid code:', result);
                throw new Error('Invalid Python code received - expected string or object with code property');
            }
            
            // Your existing file creation code...
            const tempDir = './temp';
            await fs.mkdir(tempDir, { recursive: true });
            const fileName = `animation_${Date.now()}.py`;
            const filePath = path.join(tempDir, fileName);

            // Write the generated code verbatim with ZERO modifications
            await fs.writeFile(filePath, pythonCode);
            
            const pythonPath = '../manim-env/bin/python';
            const envWithTex = { ...process.env, PATH: `${process.env.PATH || ''}:/Library/TeX/texbin` };
            const manimProcess = spawn(pythonPath, ['-m', 'manim', '-pqh', filePath, 'MainScene'], { env: envWithTex });
            
            let stdout = '';
            let stderr = '';
            
            // Capture output
            manimProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            manimProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            manimProcess.on('close', (code) => {
                if (code === 0) {
                    // Look for the "File ready at" line and extract the path more carefully
                    const lines = stdout.split('\n');
                    let filePath = null;
        
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('File ready at')) {
                            // The path might be on the same line or continue on next lines
                            let fullLine = lines[i];
                            let j = i + 1;
                
                            // Keep adding lines until we find a complete path or hit another INFO line
                            while (j < lines.length && !lines[j].includes('INFO') && !lines[j].includes('Rendered')) {
                                fullLine += lines[j].trim();
                                j++;
                            }
                
                            // Extract path from quotes
                            const match = fullLine.match(/'([^']*\.mp4)'/);
                            if (match) {
                                filePath = match[1];
                                break;
                            }
                        }
                    }
        
                    if (filePath) {
                        console.log('Extracted file path:', filePath);
            
                        // Extract relative path after 'media/videos/'
                        const pathParts = filePath.split('media/videos/');
                        if (pathParts.length > 1) {
                            const relativePath = pathParts[1];
                            const videoUrl = `http://localhost:3000/videos/${relativePath}`;
                            console.log('Final video URL:', videoUrl);
                            resolve(videoUrl);
                        } else {
                            reject(new Error('Could not parse video path'));
                        }
                    } else {
                        reject(new Error('Video path not found in output'));
                    } 
                } else {
                    console.log('STDERR:', stderr);
                    console.log('=== GENERATED PYTHON CODE ===');
                    console.log(pythonCode);
                    console.log('=== END CODE ===');
                    reject(new Error(`Manim failed with code ${code}. Check logs above.`));


                    
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}


// export default async function manimService(pythonCode){
//         return new Promise(async(resolve,reject) => {
//             try{
//                 //create temp dir and file
//                 const tempDir = './temp';
//                 await fs.mkdir(tempDir,{recursive : true}); //create folder if not exists

//                 const file_name = `animation_${Date.now()}.py`;
//                 const filePath = path.join(tempDir,file_name)

//                 //write python code in that file
//                 await fs.writeFile(filePath,pythonCode);

//                 //manim is in manim-env 

//                 const pythonPath = '../manim-env/bin/python';
//                 console.log('Python path exists:', existsSync(pythonPath));
//                 console.log('Current working directory:', process.cwd());
//                 console.log('Trying path:', path.resolve(pythonPath));
                
//                 //run manim
//                 const manimProcess = spawn(pythonPath,['-m','manim','-pqh',filePath,'MainScene']);


                

//                 //handle process event
//                 manimProcess.on('close',(code) => {
//                     if(code === 0){
//                         resolve('Video generated successfully');
//                     }else {
//                     reject(new Error('Manim execution failed'));
//                     }
//                 });
//             }catch(e){
//                 reject(e);
//             }
//         })
// }
