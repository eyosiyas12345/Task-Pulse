import express, { Request, Response } from 'express';
import {pool} from './db';
import { error } from 'console';

const app = express();

app.use(express.json());

app.get('/api/health/db',async(req:Request, res:Response)=>{
    try{
        await pool.query("SELECT 1");
        res.status(200).json({status: 'Ok', database: "Connected"});
    }
    catch{
       console.error("DB not connected",error)
       res.status(500).json({status: 'Error', database: "Disconnected"});
    }
});

export default app;
