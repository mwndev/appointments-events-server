require('dotenv').config()
const nodemailer = require('nodemailer')

const thisURL = process.env.THIS_URL

const clientURL = process.env.CLIENT_URL

const mail = async (destination, subject, html) => {
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
            user: process.env.EMAIL_ADR,
            pass: process.env.EMAIL_PASS,
        },
    })


    const options = {
        from: process.env.EMAIL_ADR,
        to: destination,
        subject: subject,
        html: html,
    }

    transporter.sendMail(options, (info, error) => {
        if(error) return console.log(error) 
        console.log(`Sent ${info.response}`)
    })


}
console.log(`this url = ${thisURL}`)

module.exports = {mail, thisURL, clientURL}