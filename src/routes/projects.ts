import {Request, Response, Router} from 'express';
import pool from '../db';
import {authenticateToken, AuthRequest} from '../middleware/auth_middleware';

const router = Router();

// Enabling project creation for authenticated users
router.post('/',
    authenticateToken, 
    async (req: AuthRequest, res:Response)=>
        {
        const {title, description} = req.body;
        
        // validate title
        if(typeof title !== 'string'|| !title.trim()|| title.length > 50){
            res.status(400).json(
                {message: "Invalid title"}
            )
            return;
        }
        
        //validate description
        if(description !== undefined && 
            description !== null && 
            (typeof description !== 'string' || description.length > 255)){
                res.status(400).json(
                    {message: "Invalid description must be a a max of 255 chars"}
                )
                return;
        }
        try{
            const result = await pool.query(
                'INSERT INTO projects (title, description, owner_id) VALUES ($1, $2, $3) RETURNING id, title, description, owner_id, created_at',
                [
                title.trim(),
                description?.trim() || null, 
                req.userId
            ]
            )
            res.status(201).json(
                {message: "Project Created successfully",
                 project: result.rows[0]
                }
            )
        }
        catch(err){
            console.error("error at creating project",err);
            res.status(500).json(
                {message: "Internal Server error"}
            )
        }
    }
);

//Get all projects for authenticated user
router.get(
    '/',
    authenticateToken,
    async(req:AuthRequest, res:Response)=>{
        try{
            const result = await pool.query(
                'SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC',
                [req.userId]
            )
            res.status(200).json(
                {
                    message: "projects retrieved successfully",
                    projects: result.rows
                 
                }
            )
        }
        catch(err){
            console.error("Error at retrieving projects", err);

            res.status(500).json(
                {message: "Internal Server Error"}
            )
        }
    }
)

//Get single project by id for authenticated user
router.get(
    '/:id',
    authenticateToken,
    async(req:AuthRequest, res:Response)=>{
        const projectId = Number(req.params.id);
        //validate projectId
        if(!Number.isInteger(projectId)||projectId <= 0){
            res.status(400).json(
                {message: "Invalid project id"}
            )
            return;
        }
                
        try{
            const result = await pool.query(
                'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',[projectId, req.userId]
            )
            if(result.rows.length === 0){
                res.status(404).json(
                    {message: "project not found"}
                )
                return;
            }
            res.status(200).json(
                {
                message:`Project with id ${projectId} retrieved successfully`, 
                project: result.rows[0]
            }
            )

        }
        catch(err){
            console.error("Error @ retrieving single project",err);
            res.status(500).json(
                {message: "Internal Server Error"}
            )
        }
    }
)

//Update a project
router.put(
    '/:id',
    authenticateToken,
    async(req:AuthRequest, res:Response)=>{
        const projectId = Number(req.params.id);
        const {title, description} = req.body;

            //validate project id
            if(!Number.isInteger(projectId)||projectId <= 0){
                res.status(400).json(
                    {message: "Invalid project id"}
                )
                return;
            }
            //validate title
            if(title !== undefined &&(typeof title !== 'string'|| !title.trim() || title.length> 50)){
                res.status(400).json(
                    {message: 'Invalid title'}
                )
                return;
            }
            //validate description
            if(description !== undefined && (typeof description !== 'string' || description.length >255)){
                res.status(400).json(
                    {message: 'Invalid description'}
                )
                return;
            }
            //result
            try{
                const result = await pool.query(
                    'UPDATE projects SET title = COALESCE($1, title), description = CASE WHEN $2::boolean THEN $3 ELSE description END WHERE id = $4 AND owner_id = $5 RETURNING * ',
                    [
                        title === undefined ? null:title.trim(),
                        description !== undefined,
                        description === null || description === undefined ? null:description.trim(),
                        projectId,
                        req.userId    
                    ]
                )
                if(result.rows.length ===0){
                    res.status(404).json(
                        {message: 'Project not found'}
                    );
                    return;
                }
                res.status(200).json(
                    {
                        message: 'project updated successfully',
                        project: result.rows[0]
                    }
                )

            }
            catch(err){
                console.error(err);
                res.status(500).json(
                    {message: "Internal Server Error",
                        error: err
                    }
                )
            }

    }
);

//Delete project
router.delete(
    '/:id',
    authenticateToken,
    async(req:AuthRequest, res:Response)=>{
        const projectId = Number(req.params.id);
        //validate project id
        if(!Number.isInteger(projectId)||projectId<=0){
            res.status(400).json(
                {message: 'Invalid project ID'}
            )
            return;
        }
        try{
            const result = await pool.query('DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING *',
                [
                    projectId,
                    req.userId
                ]
            );
            if(result.rows.length === 0){
                res.status(404).json(
                    {message: 'Project Not Found'}
                )
                return;
            }
            res.status(200).json(
                {
                    message: 'Project Deleted',
                    project: result.rows[0]
                }
            )
        }
        catch(err){
            console.log(err);
            res.status(500).json(
                {message:'Internal Server error'}
            )
        }
    }
);

export default router;