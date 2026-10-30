import express, { Request, Response } from 'express';
import pool from './db';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects'
import {authenticateToken, AuthRequest} from './middleware/auth_middleware';

const app = express();

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

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
