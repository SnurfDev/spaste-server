import express, {RequestHandler} from "express"
import cors from "cors"
import db, {Post, User} from "./db"
import Cache from "node-cache"
import cookieParser from "cookie-parser"
import bodyParser from "body-parser";
import * as crypto from "crypto";
import {sendMail} from "./mailer";

let app = express();

app.use(cors({origin:"*"}));
app.use(cookieParser());

let tokens = new Cache();
let verificationCodes = new Cache({stdTTL:5*60});

declare global {
    namespace Express {
        interface Request {
            authId:number
        }
    }
}
const sha256 = (data:string|Buffer)=>crypto.createHash("sha256").update(data).digest("hex");
const sendError = (res:express.Response,code:number,reason:string)=>res.status(code).json({success:false,data:null,reason})

app.post("/login",bodyParser.json(),async (req,res)=>{
    let loginBody:{username:string,password:string} = req.body;
    if(!loginBody.username || !loginBody.password) return sendError(res,400,"Bad Request");
    let loggedIn = await db.login(loginBody.username,sha256(loginBody.password));
    if(!loggedIn) return sendError(res,401,"Invalid Username/Password")

    let token = sha256(crypto.randomBytes(32));
    tokens.set(token,loggedIn,60*5);
    res.json({success:true,data:token});
});

app.post("/register",bodyParser.json(),async (req,res)=>{
    let registerBody:{username:string,email:string,password:string,verifyCode?:string} = req.body;
    if(!registerBody.username || !registerBody.password || !registerBody.email) return sendError(res,400,"Bad Request");
    let verificationCode = registerBody.verifyCode;
    if(!verificationCode) {
        try {
            let code = Math.floor(Math.random()*999999).toString().padStart(6,'0');
            verificationCodes.set(sha256(registerBody.username+registerBody.password+registerBody.email),code);
            await sendMail(registerBody.email,"Verification Code",`Your Verification code is ${code}`);
            return res.json({success:true,data:"verify_code"})
        }catch {
            return sendError(res,500,"Can't send email");
        }
    }
    let realCode = verificationCodes.get<string>(sha256(registerBody.username+registerBody.password+registerBody.email));
    if(verificationCode !== realCode) return sendError(res,400,"Wrong Code");
    let newId = (await db.createUser({username:registerBody.username,passhash:sha256(registerBody.password),email:registerBody.email}));
    if(!newId) return sendError(res,500,"Internal Server Error");
    let token = sha256(crypto.randomBytes(32));
    tokens.set(token,newId,60*5);
    res.json({success:true,data:token});
})
const auth:(required:boolean)=>RequestHandler =(required)=>(req,res,next)=>{
    let authorized = false;
    let uid = 0;

    if(req.headers.authorization) {
        let [authType,token] = req.headers.authorization.split(" ");
        if(authType == "Bearer" && tokens.has(token)) {
            authorized = true;
            uid = tokens.get<number>(token);
            tokens.ttl(token,60*5);
        }
    }

    if(required && !authorized) {
        return res.status(401).json({success:false,data:null,reason:"Unauthorized"})
    }
    if(authorized) req.authId = uid;
    next();
}

app.route("/user/:id")
    .get(auth(false),async (req,res)=>{
        let uid = parseInt(req.params.id);
        if(isNaN(uid)) {
            if(req.params.id == "@me" && req.authId) {
                uid = req.authId;
            }else{
                uid = await db.getUserByName(req.params.id);
            }
            if(!uid) return sendError(res,404,"Not Found");
        }
        let user = await db.getUser(uid);
        if(!user) return sendError(res,404,"Not Found");
        if(user.id != req.authId && user.email) delete user.email;
        delete user.passhash;
        res.json({success:true,data:user});
    })
    .patch(auth(true),bodyParser.json(),async(req,res)=>{
        let user = await db.getUser(req.authId);
        if(req.params.id != "@me" && !user.isAdmin) return sendError(res,403,"You can only edit your own profile");
        let u2p = await db.getUser((req.params.id == "@me")?user.id:Number(req.params.id));
        let newData:{username:string,password:string,passhash?:string} = req.body;
        if(newData.password) newData.passhash = sha256(newData.password);
        u2p.username = newData.username ?? u2p.username;
        u2p.passhash = newData.passhash ?? u2p.passhash;
        if(! await db.editUser(u2p.id,u2p)) return sendError(res,500,"Internal Server Error");
        res.json({success:true,data:u2p.id});
    })
    .delete(auth(true),async(req,res)=>{
        let user = await db.getUser(req.authId);
        if(req.params.id != "@me" && !user.isAdmin) return sendError(res,403,"You can only delete your own account");
        let u2d = await db.getUser((req.params.id == "@me")?user.id:Number(req.params.id));
        if(! await db.deleteUser(u2d.id)) return sendError(res,500,"Internal Server Error");
        res.json({success:true,data:null});
    })


app.route("/post/:id")
    .get(auth(false),async (req,res)=>{
        let post = await db.getPost(Number(req.params.id));
        if(!post) return sendError(res,404,"Post Not Found");
        post.ownerName = (await db.getUser(post.ownerId??1,false)).username;
        res.json({success:true,data:post});
    })
    .patch(auth(true),bodyParser.json(),async (req,res)=>{
        let post = await db.getPost(Number(req.params.id));
        if(!post) return sendError(res,404,"Post Not Found");
        if(post.ownerId != req.authId && !(await db.getUser(req.authId)).isAdmin) return sendError(res,403,"Can't edit other users posts");
        let newData:Post = req.body;
        post.title = newData.title ?? post.title;
        post.lang = newData.lang ?? post.lang;
        post.content = newData.content ?? post.content;
        if(! await db.editPost(post.id,post)) return sendError(res,500,"Internal Server Error");
        res.json({success:true,data:post.id});
    })
    .delete(auth(true),async(req,res)=>{
        let post = await db.getPost(Number(req.params.id));
        if(!post) return sendError(res,404,"Post Not Found");
        if(post.ownerId != req.authId  && !(await db.getUser(req.authId)).isAdmin) return sendError(res,403,"Can't delete other users posts");
        if(! await db.deletePost(post.id)) return sendError(res,500,"Internal Server Error");
        res.json({success:true,data:null});
    })


app.post("/post",bodyParser.json(),auth(false),async (req,res)=>{
    let postBody: Post = req.body;
    if(!postBody.title || !postBody.lang || !postBody.content) return sendError(res,400,"Bad Request");
    postBody.ownerId = req.authId??0;
    let pid = await db.makePost(postBody);
    if(!pid) return sendError(res,500,"Internal Server Error");
    res.json({success:true,data:pid});
})
if(require.main === module) {
    db.init().then(()=>app.listen(8080));
}else {
    db.init();
    module.exports = app;
}