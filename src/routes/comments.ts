import {Router, Response} from 'express'
import { AuthRequest, authenticateToken } from '../middleware/auth_middleware.js'
import pool from '../db.js'

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
            );
            if(task.rows.length === 0){
                res.status(404).json(
                    {message: "Task Not Found"}
                )
                return;
            }
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

//Retrieve 1 comment
router.get(
    '/comments/:commentId',
    authenticateToken,
    async(req:AuthRequest, res:Response)=>{
        const commentId = Number(req.params.commentId);
        const userId = req.userId;
        //validate comment id
        if(!Number.isInteger(commentId)||commentId<=0){
            res.status(400).json(
                {message: "Invalid comment Id"}
            )
            return;
        }
            try{
            //check if the comment existes
            const comment = await pool.query(
                'SELECT * FROM comments WHERE id = $1',
                [commentId]
                );
                if(comment.rows.length === 0){
                    res.status(404).json(
                        {message: "Comment not found"}
                    )
                    return;
                }
            //check if the user is owner or member
            //extract task id and project id
            const taskId = comment.rows[0].task_id
            const task = await pool.query(
                'SELECT project_id FROM tasks WHERE id = $1',
                [taskId]
            );
            if(task.rows.length === 0){
                res.status(404).json(
                    {message: "Task Not Found"}
                );
                return;
            }
            const projectId = task.rows[0].project_id;
            //check if the user is owner or member of the project
            const owner = await pool.query(
                'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
                [projectId, userId]
            );
            if(owner.rows.length === 0){
                const member = await pool.query(
                    'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
                    [projectId, userId]
                );
                if(member.rows.length === 0){
                    res.status(403).json(
                        {message: "Forbidden, Access denied"}
                    )
                    return;
                }
            }
            //retrieve the result
                res.status(200).json(
                    {
                        message: "Retried 1 comment successfully",
                        comment: comment.rows[0]
                    }
                );       
                  }
            catch(err){
                console.error("Error while getting single comment", err);
                res.status(500).json(
                    {message: "Internal Server Error"}
                )
            }
    }
);

//UPDATE a comment router
router.patch(
    '/comments/:commentId',
    authenticateToken,
    async(req: AuthRequest, res:Response)=>{
        // 1. Get the comment ID and authenticated user's ID
        const commentId = Number(req.params.commentId);
        const authorId = req.userId;        
        // 2. Get the new content from the request body
        const updatedContent = req.body.content;        
        // 3. Validate the comment ID
        if(!Number.isInteger(commentId)||commentId <= 0){
            res.status(400).json(
                {message: "Invalid Comment Id"}
            );
            return;
        }
        // 4. Validate the new comment content
        if(typeof(updatedContent) !== "string" || updatedContent.trim().length ===0 ){
              res.status(400).json(
                {message: "Invalid updated Content"}
            );
            return;
        }

        try{
          // 5. check the existance of the comment
          const comment = await pool.query(
            'SELECT * FROM comments WHERE id = $1',
            [commentId]
          );
          if(comment.rows.length === 0){
            res.status(404).json(
                {message: "Comment Not Found"}
            );
            return;
          }
          // 6. Check whether the authenticated user is the author
          if(comment.rows[0].author_id !== authorId){
            res.status(403).json(
                {message: "Access denied, your not the author the comment."}
            );
            return;
          }
         // 7. Update the comment in the database
         const updatedComment = await pool.query(
            'UPDATE comments SET content = $1 WHERE id = $2 AND author_id = $3 RETURNING *',
            [updatedContent, commentId, authorId]
         );
        // 8. Check whether the update succeeded
         if(updatedComment.rows.length === 0){
            res.status(500).json(
                {message: "Failed To Update the comment"}
            );
            return;
         }
        // 9. Return the updated comment
         res.status(200).json(
            {
                message: "Comment Updated Successfully",
                updatedComment: updatedComment.rows[0]
            }
         )
          
        }
        catch(err){
             console.error("Error while updating comment", err);
                res.status(500).json(
                    {message: "Internal Server Error"}
                );
        }
    }
);

//DELETE COMMENT
router.delete(
    '/comments/:commentId',
    authenticateToken,
    async(req:AuthRequest, res:Response)=>{
        //1. get commentId and authorId
        const commentId = Number(req.params.commentId);
        const authorId = req.userId;
        //2.validate the comment id
        if(!Number.isInteger(commentId) || commentId <=0){
            res.status(400).json(
                {message: "Invalid comment id"}
            );
            return;
        }
        try{
        //3. check comment's existance
            const comment = await pool.query(
                'SELECT * FROM comments WHERE id = $1',
                [commentId]
            );
            if(comment.rows.length === 0){
                res.status(404).json(
                    {message: "Comment Not Found"}
                );
                return;
            }
        //4. check if the user is author
            if(authorId !== comment.rows[0].author_id){
                res.status(403).json(
                    {message: "Access Denied. Only author of the comment can delete it."}
                );
                return;
            }
        //5. Delete the comment from db
        const deletedComment = await pool.query(
            'DELETE FROM comments WHERE id = $1 AND author_id = $2 RETURNING *',
            [commentId, authorId]
        );
        if(deletedComment.rows.length === 0){
            res.status(500).json(
                {message: "Failed to DELETE the comment"}
            );
            return;
        }
        //6. Return the deleted comment
        res.status(200).json(
            {
                message: "Comment DELETED Successfully.",
                deletedComment: deletedComment.rows[0]
            }
        );
        }
        catch(err){
            console.error("Error while DELETING comment", err);
                res.status(500).json(
                    {message: "Internal Server Error"}
                );
        }
    }
)

export default router;

