import express, { Request, Response } from 'express';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js'
import membersRoutes from './routes/members.js'
import tasksRoutes from './routes/tasks.js' 
import commentsRoutes from './routes/comments.js'
import {authenticateToken, AuthRequest} from './middleware/auth_middleware.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'node:fs';
import path from 'node:path';

const openApiPath = path.resolve(process.cwd(),'openapi.yaml');
const openApiDocument = YAML.parse(
    fs.readFileSync(openApiPath, 'utf-8')
)

const app = express();

app.use('/api-doc', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api', commentsRoutes);

app.get('/api/health/db',async(req:Request, res:Response)=>{
    try{
        await pool.query("SELECT 1");
        res.status(200).json({status: 'Ok', database: "Connected"});
    }
    catch(err){
       console.error("DB not connected", err)
       res.status(500).json({status: 'Error', database: "Disconnected"});
    }
});
app.get(
    '/api/auth/me',
    authenticateToken,
    (req: AuthRequest, res: Response) =>{
        res.status(200).json(
            {message: 'Authenticated User app',
            userId: req.userId
            }
        )
    }
)

export default app;
