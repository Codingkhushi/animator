import { spawn } from "child_process";
import fs from 'fs/promises';
import path from 'path';

export default async function p5Service(p5code){
    return new Promise(async(resolve,reject) => {
        try{
            const tempDir = './temp'
            const fileName = `p5_animation_${Date.now()}.js`;
            const htmlFileName = `p5_animation_${Date.now()}.html`;
            const filePath = path.join(tempDir,fileName);
            const htmlPath = path.join(tempDir,htmlFileName);

            console.log('Writing P5.js files:');
            console.log('JS file:', filePath);
            console.log('HTML file:', htmlPath);

            await fs.writeFile(filePath,p5code);

            // Create HTML wrapper for P5.js
            const htmlWrapper = `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"></script>
    <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: black; }
        canvas { border: 1px solid #333; }
    </style>
</head>
<body>
    <script src="${fileName}"></script>
</body>
</html>`;


        await fs.writeFile(htmlPath,htmlWrapper);

        resolve(`http://localhost:3000/p5/${htmlFileName}`)

        }catch(e){
            console.log("Error in p5 :",e)
            reject(e)
        }

    })


    
}