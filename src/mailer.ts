import nodemailer from "nodemailer"

let transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        type: "OAUTH2",
        user: process.env.GMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: process.env.GMAIL_ACCESS_TOKEN
    }
})

export async function sendMail(to:string,title:string,content:string) {
    await transport.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject: title,
        text: content
    });
}