import express, { Request, Response } from 'express';
import {pool} from './db';

const app = express();

app.use(express.json());

app.get('/api/health',(req:Request, res:Response)=>{
    res.status(200).json({status:'ok'});
});

export default app;
