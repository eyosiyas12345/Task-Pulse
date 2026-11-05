import {Response, Router} from 'express';
import pool from '../db';
import {authenticateToken, AuthRequest} from '../middleware/auth_middleware';

const router = Router();

//Add task to a project
router.post(
    '/',
    authenticateToken,
    async(req: AuthRequest, res: Response) =>{
        const ownerId = req.userId;
        const {projectId,title, description, status, priority, assignee_id, due_date } = req.body;
       
       //strongly required  with no defualt
       if(!ownerId || !projectId || !title ){
        res.status(400).json(
            {message: "Required filled havn't fullfilled"}
        );
        return;
       }
        //validate owner id
        if(!Number.isInteger(ownerId)|| ownerId <= 0){
             res.status(400).json(
                {message: "Invalid owner id"}
            )
            return;
        }
        //validate project id
        if(!Number.isInteger(projectId)|| projectId <= 0){
             res.status(400).json(
                {message: "Invalid project id"}
            )
            return;
        }        
        //validate title
        if(typeof(title) !== "string" || title.trim().length === 0 || title.trim().length > 50 ) {
            res.status(400).json(
                {message: "Invalid title"}
            )
            return;
        }
        //validate description
        if(description && (typeof(description) !== "string" )){
            res.status(400).json(
                {message: "Invalid description"}
            )
            return;
        }
        //validate status
        if(status && (typeof(status) !== "string" || !["To Do","In Progress","Completed"].includes(status))){
          res.status(400).json(
            {message: "Invalid status"}
          );
          return;
        }   
        //validate priority
        if(priority && (typeof(priority) !== "string" || !['Low','Medium','High'].includes(priority))){
          res.status(400).json(
            {message: "Invalid priority"}
          );
          return;
        }   
        //validate assignee_id
        if(assignee_id && (!Number.isInteger(assignee_id)||assignee_id <=0)){
             res.status(400).json(
            {message: "Invalid assignee id"}
          );
          return;
        }
         //validate due_date
         if(due_date){
            const parsedDate = new Date(due_date);
            if(typeof(due_date) !== "string" || isNaN(parsedDate.getTime())){
                res.status(400).json(
                    {message: "Invalid due date"}
                )
            }
        }
        //try-catch for database insertion
        try{
            const project = await pool.query(
                'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
                [projectId, ownerId]
            );
            //check if project exists and is owned by the user
            if(project.rows.length === 0){
                res.status(404).json(
                    {
                        message: "Project not found or not owned"
                    }
                );
                return;
            }
            const assignee = await pool.query(
                'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
                [projectId, assignee_id]
            );
            if(assignee_id && assignee.rows.length === 0){
                res.status(401).json(
                    {message: "Assignee is not member of the project"}
                );
                return;
            }

            //insert task into database
            const newTask = await pool.query(
                'INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [projectId, title, description || null, status || 'To Do', priority || 'Medium', assignee_id || null, due_date || null]
            );
            if(newTask.rows.length === 0){
                res.status(500).json(
                    {message: "Failed to create task"}
                )
                return;
            }
            res.status(201).json(
                {
                    message: "Task created successfully",
                    task: newTask.rows[0]
                }
            );
        }
        catch(err){
            console.error("Error inserting task to database", err);
            res.status(500).json(
                {
                message: "Internal server error",
                error: err
            }
            )
        }
     }
);

//router to get all tasks for a project
router.get(
    '/project/:projectId',
    authenticateToken,
    async(req: AuthRequest, res: Response)=>{
        const ownerId = req.userId;
        const projectId = Number(req.params.projectId);
        //validate projectId
        if(!Number.isInteger(projectId)||projectId <= 0){
            res.status(400).json(
                {message: "Invalid project Id"}
            )
            return;
        }
        //try-catch for database retrieval
        try{
            //Check whether the project exists.
            const project = await pool.query(
                'SELECT title FROM projects WHERE id = $1 AND owner_id = $2',
                [projectId, ownerId]
            );
            if(project.rows.length === 0){
             res.status(404).json(
                {message: "Project not found"}
             )
             //Verify that the authenticated user is either the project owner or a member.
             const member = await pool.query(
                 'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
                 [projectId, ownerId]
             );
             if(member.rows.length === 0){
                 res.status(403).json(
                     {message: "Access denied. You are not a member of this project."}
                 )
                 return;
             }
            }
            //Retrieve task for the project
            const task = await pool.query(
                'SELECT * FROM tasks WHERE project_id = $1',
                [projectId]
            );
            res.status(200).json({
                message: "Tasks retrieved successfully",
                tasks: task.rows
            });
        }
        catch(err){
         console.error("Error retrieving tasks",err);   
        }
    }
);

//router to get a task by id
router.get(
    '/:taskId',
    authenticateToken,
    async(req: AuthRequest, res: Response)=>{
        const taskId = Number(req.params.taskId);
        const ownerId = req.userId;
        //validate task id
        if(!Number.isInteger(taskId)||taskId<=0){
            res.status(400).json(
                {message: "Invalid task Id"}
            )
            return;
        }
        try{
            //check if the task existes
            const task = await pool.query(
                'SELECT * FROM tasks WHERE id = $1',
                [taskId]
                );
                if(task.rows.length === 0){
                    res.status(404).json(
                        {message: "Task not found"}
                    )
                    return;
                }
                //check if the user owner or member of the project
                const projectId = task.rows[0].project_id;
                const projectOwnerId = await pool.query(
                    'SELECT owner_id FROM projects WHERE id = $1',
                    [projectId]
                );
                if(projectOwnerId.rows[0].length === 0){
                
                    const member = await pool.query(
                        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
                        [projectId, ownerId]
                    );
                    if(member.rows.length === 0){
                        res.status(403).json(
                            {message: "Access denied. You are not a member of the project."}
                        );
                    }
                }
            res.status(200).json(
                {
                    message: "Task retrieved successfully",
                    task: task.rows[0]
                }
            )
        }
        catch(err){
            console.error("The Error Occured", err);
            res.status(500).json(
                {
                    message: "Internal server error",
                    error: err
                }
            )
        }
    }
)

export default router;