import {Response, Router} from 'express'
import pool from '../db.js'
import { authenticateToken, AuthRequest } from '../middleware/auth_middleware.js'

const router = Router();

//Add members to project
router.post(
 '/projects/:id/members',
    authenticateToken,
    async(req:AuthRequest, res: Response)=>{
        const projectId = Number(req.params.id);
        const userId = req.body.userId;
        const ownerId = req.userId;

        //validate the projectid
        if(!Number.isInteger(projectId)||projectId <= 0){
            res.status(400).json(
                {message: 'Invalid project id'}
            )
            return;
        }
        //validate the userid
        if(!Number.isInteger(userId)||userId<=0){
            res.status(400).json(
                {message: 'Invalid user id'}
            )
            return;
        }

        try{
            //check if the user is already a member or not
            const alreadyMember = await pool.query(
                'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
                [projectId, userId]
            )
            if(alreadyMember.rows.length === 0){
                res.status(409).json(
                    {message: "member is already added."}
                )
            }
            //check whether the authenticated user ownes the project?
            const project = await pool.query(
                'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
                [
                    projectId,
                    ownerId
                ]
            ) ;
            if(project.rows.length === 0 ){
                res.status(404).json(
                    {message: 'Project Not Found'}
                )
                return;
            }
            //Add member to the database
            const result = await pool.query(
                'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) RETURNING *',
                [
                    projectId,
                    userId
                ]
            )

            //if the project owned by the authenticated user.
            res.status(201).json(
                {
                    message: 'Member added Successfully',
                    member: result.rows[0]
                }
            )
        }
        catch(err){
            console.error('Error while adding member to project',err);

            res.status(500).json(
                {message: 'Internal Server Error'}
            )
        }
    }

);
//router to get all members of a project
router.get(
    '/projects/:id/members',
    authenticateToken,
    async(req: AuthRequest, res:Response) => {
        const projectId = Number(req.params.id);
        const ownerId = req.userId;
        //valid projectId 
        if(!Number.isInteger(projectId) || projectId <= 0){
            res.status(400).json(
                {message: 'Invalid project ID'}
            )
            return;
        }
        try{
            //check if the authenticated user ownes the project
            const result = await pool.query(
                'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
                [
                    projectId,
                    ownerId
                ]
            )
            //check if the project is found
            if( result.rows.length === 0){
                res.status(404).json(
                    {message: 'project not found'}
                )
                return;
            }
            //get all members of the project
            const members = await pool.query(
                'SELECT user_id, role FROM project_members WHERE project_id = $1',
                [projectId]
            ) 
            res.status(200).json({message: 'Members found', members: members.rows})
        }
        catch(err){
            console.error('Error while fetching project members',err);
            res.status(500).json(
                {message: 'Internal Server Error'}
            )
        }
    }
)


//DELETE member from project
router.delete(
    '/projects/:id/members/:userId',
    authenticateToken,
    async(req: AuthRequest, res: Response)=>{
        const ownerId = req.userId;
        const memberId = Number(req.params.userId);
        const projectId = Number(req.params.id);
        //validate projectId and userId
        if(!Number.isInteger(projectId) || projectId <=0){
            res.status(400).json(
                {message: "Invalid Project Id"}
            )
            return;
        }
        if(!Number.isInteger(memberId)){
            res.status(400).json(
                {message: "Invalid Member Id"}
            )
            return;
        }

        try{
            //check truth of project ownership
            const project = await pool.query(
                'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
                [projectId, ownerId]
            );
            if(project.rows.length === 0){
                res.status(404).json(
                    {message: "Project Not Found"}
                )
                return;
            }
            //delete the member from the project
            const result = await pool.query(
                'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING *',
            [projectId, memberId]
        );
        if(result.rows.length === 0){
            res.status(404).json(
                {message: "Member Not Found"}
            );
            return;
        }
        res.status(200).json(
            {
                message: "Member Deleted Successfully",
                member: result.rows[0]
            }
        )
        }
        catch(err){
            console.error("Error while deleting a member", err);
            res.status(500).json(
                {
                    message: "Internal Server Error",
                    error: err
                }
            )
        } 
    }
)

export default router;