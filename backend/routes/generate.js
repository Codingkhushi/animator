import express from 'express';
import GetLLMResponse from '../services/llmService.js';
import manimService from '../services/manimService.js';
import p5Service from '../services/p5Service.js';

const router = express.Router();

router.post('/',async(req,res) => {
    try{
        const {prompt ,library = "manim"} = req.body

        if(!prompt){
            return res.status(403).json({
                msg: "Prompt is required"
            });
        }
        let result = '';
        let outputUrl = '';

        if (library === 'p5') {
            result = await GetLLMResponse(prompt, 'p5');
            outputUrl = await p5Service(result);
        } else {
            result = await GetLLMResponse(prompt, 'manim');
            outputUrl = await manimService(result);
        }



        // const result = await GetLLMResponse(prompt)
        // console.log('=== LLM Generated Code ===');
        // console.log(result);
        // console.log('=== End of Code ===');
        // const videoPath = await manimService(result)
        res.json({
            msg : "Generated completed",
            library : library,
            outputUrl : outputUrl,
            prompt : prompt,
            generatedOutput : result,
            status : "processing",
            jobId: `job_${Date.now()}`
        });
    }catch(e){
        console.log("Generation Error",e);
        res.status(500).json({
            msg: "Failed to generate animation"
        })
    }
})

export default router;