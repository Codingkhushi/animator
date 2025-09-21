import { spawn } from "child_process";
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

function cleanPythonCode(code) {
    return code
        .replace(/```python\s*/g, '')     // Remove ```python
        .replace(/```\s*/g, '')           // Remove closing ```
        .replace(/^python\s*/gm, '')      // Remove standalone "python" 
        .trim();                          // Remove extra whitespace
}

export default async function manimService(pythonCode) {
    return new Promise(async (resolve, reject) => {
        try {
            // Your existing file creation code...
            const tempDir = './temp';
            const fileName = `animation_${Date.now()}.py`;
            const filePath = path.join(tempDir, fileName);

            const cleanCode = cleanPythonCode(pythonCode);
            console.log('=== Cleaned Code ===');
            console.log(cleanCode);
            console.log('=== End Cleaned Code ===');
            await fs.writeFile(filePath, cleanCode);
            
            //await fs.writeFile(filePath, pythonCode);
            
            const pythonPath = '../manim-env/bin/python';
            const manimProcess = spawn(pythonPath, ['-m', 'manim', '-pqh', filePath, 'MainScene']);
            
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