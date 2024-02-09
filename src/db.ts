import mariadb from "mariadb";
import 'dotenv/config'
import { v4 as generateUUID } from 'uuid';

let pool = mariadb.createPool({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, connectionLimit: 5});

export type Post = {
    uuid:string,
    title:string,
    lang:string,
    content:string,
    ownerId?:string,
    ownerName?:string,
    created:number,
    edited:number
}

export type UserPost = {title:string,uuid:string,created:number};

export type User = {
    uuid:string,
    username: string,
    passhash?:string,
    joindate:number,
    email?:string,
    posts?: UserPost[],
    isAdmin?: number
}

export const ANONID = "00000000-0000-0000-0000-000000000000";

export default {
    async init() {
        let mainDB = await pool.getConnection();
        await mainDB.execute("CREATE DATABASE IF NOT EXISTS spaste");
        await mainDB.execute("USE spaste")
        await mainDB.execute("CREATE TABLE IF NOT EXISTS users (uuid UUID PRIMARY KEY,username VARCHAR(32),email VARCHAR(64),passhash VARCHAR(64),joindate INTEGER,isAdmin INTEGER)");
        await mainDB.execute("CREATE TABLE IF NOT EXISTS posts (uuid UUID PRIMARY KEY,title VARCHAR(255),lang VARCHAR(16),content TEXT,ownerId UUID,created INTEGER,edited INTEGER, publicStatus INTEGER)");
        await mainDB.end();
    },
    async getUser(uid:string,posts:boolean=true):Promise<User|null> {
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        let user:User;
        try {
            if(uid==ANONID) {
                user = {username:"anonymous",passhash:"",uuid:ANONID,joindate:0}
            }else{
                [user] = await mainDB.query<User[]>("SELECT * FROM users WHERE uuid = ?",[uid]);
            }
            if(!posts || !user) return user;
            user.posts = await mainDB.query<UserPost[]>("SELECT uuid,title,created FROM posts WHERE ownerId = ? ORDER BY edited DESC", [uid]);
        }catch {
            user = null;
        }finally {
            await mainDB.end();
        }
        return user;
    },
    async createUser(user:{username:string,passhash:string,email:string}):Promise<string|null> {
        if(await this.getUserByName(user.username)) return null;

        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        let newId:string = generateUUID();
        try {
            await mainDB.query("INSERT INTO users(uuid,username,passhash,email,joindate) VALUES(?,?,?,?,UNIX_TIMESTAMP())",[newId,user.username,user.passhash,user.email]);
        }catch {
            newId = null
        }
        finally {
            await mainDB.end();
        }
        return newId
    },
    async editUser(uid:string,user:User):Promise<boolean> {
        let existingUser = await this.getUserByName(user.username);
        if(existingUser && existingUser != uid) return false;

        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        try {
            await mainDB.execute("UPDATE users SET username=?,passhash=? WHERE uuid = ?",[user.username,user.passhash,uid]);
            success = true;
        }finally {
            await mainDB.end()
        }
        return success;
    },
    async deleteUser(uid:string):Promise<boolean> {
        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        try {
            await mainDB.execute("DELETE FROM users WHERE uuid=?",[uid]);
            success = true;
        }finally {
            await mainDB.end();
        }
        return success;
    },
    async getPost(pid:string):Promise<Post|null> {
        let post:Post = null;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        try {
            [post] = await mainDB.query<Post[]>("SELECT * FROM posts WHERE uuid = ?", [pid]);
        }finally {
            await mainDB.end()
        }
        return post;
    },
    async makePost(post:Post):Promise<string|null> {
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        let newId:string = generateUUID();
        try {
            await mainDB.query("INSERT INTO posts(uuid,title,lang,content,ownerId,created,edited) VALUES(?,?,?,?,?,UNIX_TIMESTAMP(),UNIX_TIMESTAMP())",[newId,post.title,post.lang,post.content,post.ownerId]);
        }catch {
            newId = null
        }finally {
            await mainDB.end();
        }
        return newId
    },
    async editPost(pid:string,post:Post):Promise<boolean> {
        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        try {
            await mainDB.execute("UPDATE posts SET title=?,lang=?,content=?,edited=UNIX_TIMESTAMP() WHERE uuid = ?",[post.title,post.lang,post.content,pid]);
            success = true;
        }finally {
            await mainDB.end();
        }
        return success;
    },
    async deletePost(pid:string):Promise<boolean> {
        let success = false;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        try {
            await mainDB.execute("DELETE FROM posts WHERE uuid=?",[pid]);
            success = true;
        }finally {
            await mainDB.end();
        }
        return success;
    },
    async login(username:string,passhash:string): Promise<string|null> {
        let uuid:string = null;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        try {
            let resp = await mainDB.query<{uuid:string}[]>("SELECT uuid FROM users WHERE username = ? AND passhash = ?",[username,passhash]);
            if(resp[0]) [{uuid}] = resp;
        }finally {
            await mainDB.end();
        }
        return uuid;
    },
    async getUserByName(username:string): Promise<string|null> {
        if(username=="anonymous") return ANONID;
        let uuid:string = null;
        let mainDB = await pool.getConnection();
        await mainDB.execute("USE spaste")
        try {
            let resp = await mainDB.query<{uuid:string}[]>("SELECT uuid FROM users WHERE username = ?",[username]);
            if(resp[0]) [{uuid}] = resp;
        }finally {
            await mainDB.end();
        }
        return uuid;
    }
}