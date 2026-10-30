import {Router, Request, Response} from 'express';
import bcrypt from 'bcrypt'
import pool from '../db'
import jwt from 'jsonwebtoken'

//router object to handle all the routes related to authentication
const router = Router();

//Enabling registration of new users
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

//Enabling login for registered users
router.post('/login', async(req:Request, res:Response)=>{
    const {email, password} = req.body;
    //if password/email is non-string or empty
    if(
        typeof email !== 'string'||
        typeof password != 'string'||
        !email.trim()|| !password
    ){
        res.status(400).json(
            {
                message: 'Email and Password required'
            }
        )
        return
    }
    try{
        //normalize inserted email
        const normalizedEmail = email.trim().toLowerCase();
        //search and fetch a registered user with similar email
        const result = await pool.query(
            'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',[normalizedEmail]
        );
        //check if it available or not
        if(result.rows[0].length === 0){
            res.status(401).json(
                {
                    message: 'Invalid email or password'
                }
            )
            return;
        }
        //if email is available check the password matches
        const user = result.rows[0]
        const passwordMatches =await bcrypt.compare(password, user.password_hash);
        //if password unmatch
        if(!passwordMatches){
            res.status(401).json(
                {
                    message: 'Invalid Email or Password'
                }
            )
            return ;
        }
        const token = jwt.sign(
            {userId: user.id},
            process.env.JWT_SECRET as string,
            {expiresIn: '1hr'}
        )
        //if email and password available and match
            res.status(200).json({
              message: 'Login Successfull',
              token,            
               user:{
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    created_at: user.created_at
                }
            }
            )
    }
    //If Server error happened
    catch(err){
        res.status(500).json(
            {
                message: 'Internal Server Error'
            }
        )
    }

});

export default router