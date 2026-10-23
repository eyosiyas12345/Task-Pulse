import {Router, Request, Response} from 'express';
import bcrypt from 'bcrypt'
import pool from '../db'

const router = Router();

router.post('/register',async (req:Request, res:Response)=>{
   
    const {name, email, password} = req.body;
    if(
        typeof name !== 'string' || 
        typeof email !== 'string' ||
        typeof password !== 'string'
    ){
        res.status(400).json(
            {
                message: 'name, email and password required'
            }
        )
        return;
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if( !normalizedName || !normalizedEmail|| !password)
        {
        res.status(400).json(
            {
                message: 'name,email and password required'
            }
        )
        return;
    }

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    {
        res.status(400).json(
            {
                message: 'Email is not correct'
            }
        )
        return;
    }

    if(password.length < 8){
        res.status(400).json(
            {
                message: 'minimum password length is 8'
            }
        )
        return;
    }

            // checking if the email is already registered
        try{
                    const existingUser = await pool.query(
                    'SELECT id FROM users WHERE email=$1',[normalizedEmail]
                );
            if (existingUser.rows.length > 0){
                res.status(409).json(
                    {
                        message: 'Email Already Registered'
                    }
                )
                return;
            }
       //hash the password
        const Password_hash = await bcrypt.hash(password,10);

        //insert to database
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id,name,email,role,created_at',
            [normalizedName, normalizedEmail, Password_hash]
        );

        //response after insertion
        res.status(201).json(
            {
                message: "Account Created Successfully",
                user: result.rows[0]
            }
        );
    }
    catch(err){
        console.log('Internal Server Error',err);
        res.status(500).json(
            {
                message: 'Internal Server Error'
            }
        );
    }
});

export default router