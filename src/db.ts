import mariadb from "mariadb";
import 'dotenv/config'

let pool = mariadb.createPool({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, connectionLimit: 5});

export type Post = {
    id:number,
    title:string,
    lang:string,
    content:string,
    ownerId?:number,
    ownerName?:string,
    created:number,
    edited:number
}

export type UserPost = {title:string,id:number,created:number};

export type User = {
    id:number,
    username: string,
    passhash?:string,
    joindate:number,
    email?:string,
    posts?: UserPost[],
    isAdmin?: number
}

export default {
    async init() {
        let mainDB = await pool.getConnection();
        await mainDB.execute("CREATE DATABASE IF NOT EXISTS main");
        await mainDB.execute("USE main")
        await mainDB.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTO_INCREMENT,username VARCHAR(32),email VARCHAR(64),passhash VARCHAR(64),joindate INTEGER,isAdmin INTEGER)");
        await mainDB.execute("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTO_INCREMENT,title VARCHAR(255),lang VARCHAR(16),content TEXT,ownerId INT,created INTEGER,edited INTEGER, publicStatus INTEGER)");
        await mainDB.end();
    },
    async getUser(uid:number,posts:boolean=true):Promise<User|null> {
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        let user:User;
        try {
            if(uid==0) {
                user = {username:"anonymous",passhash:"",id:0,joindate:0}
            }else{
                [user] = await mainDB.query<User[]>("SELECT * FROM users WHERE id = ?",[uid]);
            }
            if(!posts || !user) return user;
            user.posts = await mainDB.query<UserPost[]>("SELECT id,title,created FROM posts WHERE ownerId = ? ORDER BY edited DESC", [uid]);
        }catch {
            user = null;
        }finally {
            await mainDB.end();
        }
        return user;
    },
    async createUser(user:{username:string,passhash:string,email:string}):Promise<number|null> {
        if(await this.getUserByName(user.username)) return null;

        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        let newId:number = null;
        try {
            let res = await mainDB.query("INSERT INTO users(username,passhash,email,joindate) VALUES(?,?,?,UNIX_TIMESTAMP())",[user.username,user.passhash,user.email]);
            newId = Number(res.insertId);
        }finally {
            await mainDB.end();
        }
        return newId;
    },
    async editUser(uid:number,user:User):Promise<boolean> {
        let existingUser = await this.getUserByName(user.username);
        if(existingUser && existingUser != uid) return false;

        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        try {
            await mainDB.execute("UPDATE users SET username=?,passhash=? WHERE id = ?",[user.username,user.passhash,uid]);
            success = true;
        }finally {
            await mainDB.end()
        }
        return success;
    },
    async deleteUser(uid:number):Promise<boolean> {
        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        try {
            await mainDB.execute("DELETE FROM users WHERE id=?",[uid]);
            success = true;
        }finally {
            await mainDB.end();
        }
        return success;
    },
    async getPost(pid:number):Promise<Post|null> {
        let post:Post = null;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        try {
            [post] = await mainDB.query<Post[]>("SELECT * FROM posts WHERE id = ?", [pid]);
        }finally {
            await mainDB.end()
        }
        return post;
    },
    async makePost(post:Post):Promise<number|null> {
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        let newId:number = null;
        try {
            let res = await mainDB.query("INSERT INTO posts(title,lang,content,ownerId,created,edited) VALUES(?,?,?,?,UNIX_TIMESTAMP(),UNIX_TIMESTAMP())",[post.title,post.lang,post.content,post.ownerId]);
            newId = Number(res.insertId);
        }finally {
            await mainDB.end();
        }
        return newId;
    },
    async editPost(pid:number,post:Post):Promise<boolean> {
        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        try {
            await mainDB.execute("UPDATE posts SET title=?,lang=?,content=?,edited=UNIX_TIMESTAMP() WHERE id = ?",[post.title,post.lang,post.content,pid]);
            success = true;
        }finally {
            await mainDB.end();
        }
        return success;
    },
    async deletePost(pid:number):Promise<boolean> {
        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        try {
            await mainDB.execute("DELETE FROM posts WHERE id=?",[pid]);
            success = true;
        }finally {
            await mainDB.end();
        }
        return success;
    },
    async login(username:string,passhash:string): Promise<number|null> {
        let id:number = null;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        try {
            let resp = await mainDB.query<{id:number}[]>("SELECT id FROM users WHERE username = ? AND passhash = ?",[username,passhash]);
            if(resp[0]) [{id}] = resp;
        }finally {
            await mainDB.end();
        }
        return id;
    },
    async getUserByName(username:string): Promise<number|null> {
        if(username=="anonymous") return 0;
        let id:number = null;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE main")
        try {
            let resp = await mainDB.query<{id:number}[]>("SELECT id FROM users WHERE username = ?",[username]);
            if(resp[0]) [{id}] = resp;
        }finally {
            await mainDB.end();
        }
        return id;
    }
}