import {Response, Router} from 'express';
import pool from '../db.js';
import {authenticateToken, AuthRequest} from '../middleware/auth_middleware.js';

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
                const projectOwner = await pool.query(
                    'SELECT owner_id FROM projects WHERE id = $1',
                    [projectId]
                );
                if(projectOwner.rows[0].length === 0){
                
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
);

//router to update a task by id
router.put(
    '/:taskId',
    authenticateToken,
    async(req:AuthRequest, res:Response)=>{
        const taskId = Number(req.params.taskId);
        const userId = req.userId;
        const {title, description, status, priority, assignee_id , due_date} = req.body;
        //validate the task id
        if(!Number.isInteger(taskId)|| taskId <=0){
            res.status(400).json(
                {message: "invalid task id"}
            )
            return;
        }
        //validate the request body
        //validate title
        if(title && (typeof(title) !== "string" || title.trim().length === 0 || title.trim().length > 50 )) {
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
        try{
            const task = await pool.query(
                'SELECT * FROM tasks WHERE id = $1',
                [taskId]
            ); 
            if(task.rows.length === 0){
                res.status(404).json(
                    {message: "Task not found"}
                );
                return;
            }
            const projectId = task.rows[0].project_id;

            const projectOwner = await pool.query(
                'SELECT owner_id FROM projects WHERE id = $1',
                [projectId]
            );
            if(!(projectOwner.rows[0].owner_id === userId)){
                const member = await pool.query(
                    'SELECT * FROM project_members WHERE user_id = $1',
                    [userId]
                );
                if(!(member.rows[0].user_id === userId) ){
                    res.status(404).json(
                        {message: "Project Not found or you are not member of it"}
                    );
                    return;
                }
            }
            if(assignee_id){
                const member = await pool.query(
                    'SELECT * FROM project_members WHERE user_id = $1',
                    [assignee_id]
                );
                if(member.rows.length === 0){
                    res.status(403).json(
                        {message: "assignee is not member of the project"}
                    )
                    return;
                }
            }
        //Update the task in PostgreSQL.
        const updatedTask = await pool.query(
            'UPDATE tasks SET title = COALESCE($1, title),description = COALESCE($2, description),status = COALESCE($3, status), priority = COALESCE($4, priority), assignee_id = COALESCE($5, assignee_id) WHERE id = $6 RETURNING *',
            [
                title === undefined ? null:title.trim(),
                description === undefined ? null:description.trim(),
                status === undefined? null:status,
                priority === undefined? null:priority,
                assignee_id === undefined? null:assignee_id,
                taskId
            ]
        );
        if(updatedTask.rows.length === 0){
            res.status(400).json(
                {message:"Failed to Update the task"}
            );
            return;
        }
        res.status(200).json(
            {
                message: "Successfully the task is updated",
                "updated Task": updatedTask.rows[0]
            }
        )

        }
        catch(err){
            console.error("Error updating task",err);
            res.status(500).json(
                {
                    message:"Internal Server Error",
                    error: err
                }
            )
        }
    }
)

//DELETE TASK
router.delete(
    '/:taskId',
    authenticateToken,
    async(req:AuthRequest,res:Response)=>{
        const taskId = Number(req.params.taskId);
        const userId = req.userId;
        //validate task id
        if(!Number.isInteger(taskId)||taskId <= 0){
            res.status(400).json(
                {message:"Invalid task id"}
            )
            return;
        }
        try{
            //validate task existance
            const task = await pool.query(
                'SELECT * from tasks WHERE id = $1',
                [taskId]
            );
            if(task.rows.length === 0){
                res.status(404).json(
                    {message: "Task Not Found"}
                );
                return;
            }
            //validate the user ownes the task
            const projectId = task.rows[0].project_id;
            const project = await pool.query(
                'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
                [projectId, userId]
            );
            if(project.rows.length === 0){
                res.status(403).json(
                    {message: "Access denied. Only project owner can delete it' tasks."}
                );
                return;
            }
            //delete the task from database
            const deletedTask = await pool.query(
                'DELETE FROM tasks WHERE id = $1 RETURNING *',
                [taskId]
            );
            if(deletedTask.rows.length === 0){
                res.status(400).json(
                    {message: "Failed to delete the task"}
                );
                return;
            }
            res.status(200).json(
                {
                    message: "Task DELETED Successfully",
                    "deleted task": deletedTask.rows[0]
                }
            )
        }
        catch(err){
            console.error("Error while deleting task",err);
            res.status(500).json(
                {message:"Internal Server Error"}
            )
        }
    }
)

export default router;