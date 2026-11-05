import {Router, Response} from 'express'
import { AuthRequest, authenticateToken } from '../middleware/auth_middleware'
import pool from '../db'

const router = Router();

//Add a comment
router.post(
    '/tasks/:taskId/comments',
    authenticateToken,
    async(req: AuthRequest, res: Response)=>{
        const taskId = Number(req.params.taskId);
        const userId = req.userId;
        if (!req.body || typeof req.body.content !== "string" || req.body.content.trim().length === 0) {
    res.status(400).json({
        message: "Comment content is required"
    });
    return;
}
        const content = req.body.content.trim();
        //validate taskId
        if(!Number.isInteger(taskId)||taskId<=0){
            res.status(400).json(
                {message: "Invalid task id"}
            );
            return;
        }
        try{
            //validate task is exist
            const task = await pool.query(
                'SELECT * FROM tasks WHERE id = $1',
                [taskId]
            );
            if(task.rows.length === 0){
                res.status(404).json(
                    {message: "Task Not Found"}
                )
                return;
            }
            //validate the user is owner or member of the project
            const projectId = task.rows[0].project_id;
            const project = await pool.query(
                'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
                [projectId,userId]
            );
            if(project.rows.length === 0){
                const member = await pool.query(
                    'SELECT * FROM project_members WHERE user_id = $1 AND project_id = $2',
                    [userId, projectId]
                );
                if(member.rows.length === 0){
                    res.status(403).json(
                        {message: "Access Denied. You are not owner or member of the project"}
                    );
                    return;
                }
            }
            //until know we know task exist user is either owner or member of it.
            //insert the comment
            const comment = await pool.query(
                'INSERT INTO comments (task_id, author_id, content) VALUES ($1, $2, $3) RETURNING *',
                [taskId, userId, content]
            );
            if(comment.rows.length === 0){
                res.status(500).json(
                    {message: "Failed To Insert the comment"}
                );
                return;
            }
            res.status(201).json(
                {
                    message: "Comment Inserted successfully",
                    comment: comment.rows[0]
                }
            )
        }
      catch(err){
            console.error("Error while Adding a comment", err);
            res.status(500).json(
                {
                    message: "Internal Server Error",
                    error: err
                }
            )
        } 
    }
)

//GET all comments for a task
router.get(
    '/tasks/:taskId/comments',
    authenticateToken,
    async(req: AuthRequest, res:Response)=>{
        const taskId = Number(req.params.taskId);
        const userId = req.userId;
        //validate task id
        if(!Number.isInteger(taskId)||taskId<=0){
            res.status(400).json(
                {message: "Invalid task id"}
            );
            return;
        }
        try{
            //is the task exist?
            const task = await pool.query(
                'SELECT * FROM tasks WHERE id = $1',
                [taskId]
            )
            //validate user is owner or member of the project
            const projectId = task.rows[0].project_id;
            const project = await pool.query(
                'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
                [projectId, userId]
            );
            if(project.rows.length === 0){
                const member = await pool.query(
                    'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
                    [projectId, userId]
                );
                if(member.rows.length === 0){
                    res.status(403).json(
                        {message: "Access Denied, you're neither owner or member of the project."}
                    );
                    return;
                }
            }
            //Retrieve the comments
            const comments = await pool.query(
                'SELECT * FROM comments WHERE task_id = $1',
                [taskId]
            );
            if(comments.rows.length === 0){
                res.status(500).json(
                    {message: "Failed to fetch comments"}
                );
                return;
            }
            //if all is successful
            res.status(200).json(
                {
                    message: "Comments Fetched Successfully",
                    comments: comments.rows
                }
            )
        }
        catch(err){
            console.log("Error while fetching all comments", err);
            res.status(500).json(
                {message: "Internal Server Error"}
            )
        }
    }
)

export default router;