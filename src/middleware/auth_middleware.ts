import  {Request, Response, NextFunction} from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
    userId?: number
}

export function authenticateToken(
    req: AuthRequest,
    res: Response,
    next: NextFunction
){
    // Get the token from the request headers
    const authHeader = req.headers['authorization']

    if(!authHeader || !authHeader.startsWith('Bearer ')){
         res.status(401).json(
            {message: 'Token not provided'}
        )
        return;
    }
    //Extract the token from the header
    const token = authHeader.split(' ')[1];

    if(!token){
        res.status(401).json(
            {message: 'Invalid authorization header format'}
        )
        return;
    }
    //check server secret key
    const secret_key = process.env.JQT_SECRET;
    if(!secret_key){
        res.status(500).json(
            {message: 'Server secret key not configured'}
        )
        return;
    }

    try{
        // Verify the token  payload using the secret key
        const payload = jwt.verify(token, secret_key);

        if(typeof payload !== 'object' || payload.userId !== 'number'){
            res.status(401).json(
                {message: 'Invalid token payload'}
            )
            return;
        }
       res.status(200).json(
        {message: 'Token Verified successfully'}
       )
       req.userId = payload.userId;
       next();
    } 
    catch (error) {
        res.status(401).json(
            {message: 'Invalid or expired token'}
        )
    }
}