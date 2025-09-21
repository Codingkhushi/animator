import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routes/api.js";


const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename)

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

//serve video files statically 
app.use('/videos',express.static(path.join(_dirname,'media/videos'),{
    setHeaders : (res,path) =>{
        if(path.endsWith('.mp4')){
            res.setHeader('Content-Type','video/mp4');
            res.setHeader('Accept-Ranges','bytes')
        }
    }
}));

app.use('/p5', express.static(path.join(_dirname, 'temp')));

app.get('/',(req,res)=>{
    res.json({
        msg: "Cursor-2D Backend API",
        status: "running",
        environment: process.env.NODE_ENV
    });
});


app.use('/api',apiRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
});